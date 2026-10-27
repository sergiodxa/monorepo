/**
 * `shape()`: turns a run of text into positioned glyphs with OpenType layout. It picks the
 * script, language system and shaper, runs the plan's GSUB stages and GPOS, falls back to
 * the legacy `kern` table, and answers glyphs in visual order with their clusters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "../font.js";

import type { UserFeatures } from "./plan.js";
import type { GlyphPosition } from "./processor.js";
import type { ShapingFont } from "./shaping-font.js";

import { GlyphInfo } from "./glyph-info.js";
import { GposProcessor } from "./gpos.js";
import { GsubProcessor } from "./gsub.js";
import { kernPair } from "./kern.js";
import { ShapingPlan } from "./plan.js";
import {
	detectScript,
	isoScript,
	openTypeTags,
	scriptCandidates,
	scriptDirection,
} from "./scripts.js";
import { chooseShaper } from "./shapers/index.js";
import { shapingFont } from "./shaping-font.js";
import { isDefaultIgnorable, mirror } from "./unicode/properties.js";

/** How to shape a run. */
export interface ShapeOptions {
	/**
	 * The run's script, as an OpenType tag (`"arab"`, `"dev2"`) or an ISO 15924 code
	 * (`"Arab"`); detected from the first character with a script when left out.
	 */
	script?: string;
	/** An OpenType language system tag (`"URD"`, `"TRK "`); the script's default when left out. */
	language?: string;
	/** The run's direction; the script's own when left out. Right-to-left runs come back reversed. */
	direction?: "ltr" | "rtl";
	/**
	 * Features to turn on or off on top of the shaper's: `["smcp"]`, `{ liga: false, ss01: true }`,
	 * or a number to pick an alternate (`{ aalt: 2 }`).
	 */
	features?: UserFeatures;
}

/** One positioned glyph, in font units; scale by `size / font.unitsPerEm` to draw at a size. */
export interface ShapedGlyph {
	glyph: number;
	/** The characters this glyph draws, in logical order; several for a ligature. */
	codePoints: number[];
	/** UTF-16 offset in the input of the first character of this glyph's cluster. */
	cluster: number;
	/** How far the pen moves after the glyph. */
	xAdvance: number;
	yAdvance: number;
	/** Where the glyph is drawn relative to the pen, y up. */
	xOffset: number;
	yOffset: number;
}

/** A shaped run: its glyphs in visual (left-to-right) order and how it was shaped. */
export interface ShapedText {
	glyphs: ShapedGlyph[];
	/** The OpenType script tag the font's layout tables were read under. */
	script: string;
	/** The language system tag used, `null` for the script's default. */
	language: string | null;
	direction: "ltr" | "rtl";
	/** Every feature the plan applied, the shaper's and the user's. */
	features: string[];
	/** The sum of the glyphs' `xAdvance`. */
	advanceWidth: number;
}

/**
 * Shapes one run of text, a single script in a single direction: ligatures, contextual
 * forms, mark positioning and kerning as the font's GSUB, GPOS and `kern` tables describe.
 *
 * @param font - A font from `parseFont`.
 * @param text - The run; split mixed-direction text into runs first.
 * @param options - Script, language, direction and features.
 * @returns Positioned glyphs in font units, in visual order.
 * @example shape(font, "office", { features: { liga: false } }).glyphs.length // 6
 */
export function shape(font: Font, text: string, options: ShapeOptions = {}): ShapedText {
	let shaping = shapingFont(font);
	let candidates =
		options.script === undefined
			? [...openTypeTags(detectScript(text))]
			: scriptCandidates(options.script);
	let direction = options.direction ?? scriptDirection(isoScript(candidates[0] ?? "DFLT"));
	let language =
		options.language === undefined ? null : options.language.padEnd(4, " ").slice(0, 4);
	let glyphs = glyphsForText(shaping, text);
	let gsub = shaping.gsub === null ? null : new GsubProcessor(shaping, shaping.gsub);
	let gpos = shaping.gpos === null ? null : new GposProcessor(shaping, shaping.gpos);
	let chosen = gpos?.selectScript(candidates, language, direction) ?? null;
	chosen = gsub?.selectScript(candidates, language, direction) ?? chosen;
	let script = chosen !== null && candidates.includes(chosen) ? chosen : (candidates[0] ?? "DFLT");
	let plan = new ShapingPlan(shaping, chosen ?? script, direction, language);
	let shaper = chooseShaper([script]);
	shaper.plan(plan, glyphs, options.features);
	for (let required of [gsub?.requiredFeature, gpos?.requiredFeature]) {
		if (required == null || plan.allFeatures.has(required)) continue;
		plan.stages[0]?.features.push(required);
		plan.allFeatures.set(required, 0);
		for (let glyph of glyphs) glyph.features.add(required);
	}
	if (direction === "rtl") mirrorGlyphs(shaping, glyphs);
	plan.substitute(gsub, glyphs);

	let positions: GlyphPosition[] = glyphs.map((glyph) => ({
		xAdvance: font.advance(glyph.glyph),
		yAdvance: 0,
		xOffset: 0,
		yOffset: 0,
	}));
	if (shaper.zeroMarkWidths === "before-gpos") zeroMarkAdvances(glyphs, positions);
	if (gpos !== null) plan.position(gpos, glyphs, positions);
	if (shaper.zeroMarkWidths === "after-gpos") zeroMarkAdvances(glyphs, positions);
	gpos?.fixAttachments(glyphs, positions);
	if (direction === "rtl") {
		glyphs.reverse();
		positions.reverse();
	}
	let kernEnabled = !plan.disabledFeatures.has("kern");
	if (shaping.kern !== null && kernEnabled && gpos?.features.has("kern") !== true) {
		applyKernTable(shaping, glyphs, positions);
	}
	hideDefaultIgnorables(shaping, glyphs, positions);

	let shaped = glyphs.map((glyph, index): ShapedGlyph => {
		let position = positions[index] ?? { xAdvance: 0, yAdvance: 0, xOffset: 0, yOffset: 0 };
		return {
			glyph: glyph.glyph,
			codePoints: glyph.codePoints,
			cluster: glyph.cluster,
			...position,
		};
	});
	return {
		glyphs: shaped,
		script: plan.script,
		language: gsub?.languageTag ?? gpos?.languageTag ?? null,
		direction,
		features: [...plan.allFeatures.keys()],
		advanceWidth: shaped.reduce((sum, glyph) => sum + glyph.xAdvance, 0),
	};
}

/**
 * The feature tags a font's GSUB and GPOS offer under a script and language system, plus
 * `kern` when the font has a legacy `kern` table; the tags `features` can turn on.
 *
 * @param font - A font from `parseFont`.
 * @param options - The script and language to look under; the default script when left out.
 * @example availableFeatures(font, { script: "latn" }).includes("smcp")
 */
export function availableFeatures(
	font: Font,
	options: Pick<ShapeOptions, "script" | "language"> = {},
): string[] {
	let shaping = shapingFont(font);
	let candidates = options.script === undefined ? ["DFLT"] : scriptCandidates(options.script);
	let language =
		options.language === undefined ? null : options.language.padEnd(4, " ").slice(0, 4);
	let tags = new Set<string>();
	for (let table of [shaping.gsub, shaping.gpos]) {
		if (table === null) continue;
		let processor = new GsubProcessor(shaping, table);
		processor.selectScript(candidates, language, "ltr");
		for (let tag of processor.features.keys()) tags.add(tag);
	}
	if (shaping.kern !== null) tags.add("kern");
	return [...tags];
}

/**
 * One glyph per code point, each its own cluster at its UTF-16 offset.
 *
 * @param font - The shaping view.
 * @param text - The run.
 */
function glyphsForText(font: ShapingFont, text: string): GlyphInfo[] {
	let glyphs: GlyphInfo[] = [];
	let offset = 0;
	for (let character of text) {
		let codePoint = character.codePointAt(0) ?? 0;
		glyphs.push(new GlyphInfo(font, font.glyphIndex(codePoint), [codePoint], offset));
		offset += character.length;
	}
	return glyphs;
}

/**
 * Draws mirrored characters of a right-to-left run (brackets, comparison signs) with their
 * mirror's glyph, or enables `rtlm` on them when the font has no glyph for the mirror.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 */
function mirrorGlyphs(font: ShapingFont, glyphs: GlyphInfo[]) {
	for (let glyph of glyphs) {
		if (glyph.codePoints.length !== 1) continue;
		let mirrored = mirror(glyph.codePoints[0] ?? 0);
		if (mirrored === null) continue;
		let replacement = font.glyphIndex(mirrored);
		if (replacement === 0) glyph.features.add("rtlm");
		else glyph.glyph = replacement;
	}
}

/**
 * Zeroes the advances of mark glyphs, which sit over their base instead of moving the pen.
 *
 * @param glyphs - The buffer.
 * @param positions - Its positions.
 */
function zeroMarkAdvances(glyphs: readonly GlyphInfo[], positions: GlyphPosition[]) {
	for (let index = 0; index < glyphs.length; index++) {
		let position = positions[index];
		if (glyphs[index]?.isMark !== true || position === undefined) continue;
		position.xAdvance = 0;
		position.yAdvance = 0;
	}
}

/**
 * Adds legacy `kern` table adjustments between visually adjacent glyphs.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer in visual order.
 * @param positions - Its positions.
 */
function applyKernTable(
	font: ShapingFont,
	glyphs: readonly GlyphInfo[],
	positions: GlyphPosition[],
) {
	let record = font.kern;
	if (record === null) return;
	for (let index = 0; index + 1 < glyphs.length; index++) {
		let left = glyphs[index]?.glyph ?? 0;
		let right = glyphs[index + 1]?.glyph ?? 0;
		let position = positions[index];
		if (position !== undefined) position.xAdvance += kernPair(font.reader, record, left, right);
	}
}

/**
 * Hides default ignorable characters the font did not substitute (soft hyphen, joiners,
 * bidi controls): they draw as a zero-width space glyph and keep their cluster.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 * @param positions - Its positions.
 */
function hideDefaultIgnorables(
	font: ShapingFont,
	glyphs: readonly GlyphInfo[],
	positions: GlyphPosition[],
) {
	let space = font.glyphIndex(0x20);
	for (let index = 0; index < glyphs.length; index++) {
		let glyph = glyphs[index];
		let position = positions[index];
		let codePoint = glyph?.codePoints[0];
		if (glyph === undefined || position === undefined || codePoint === undefined) continue;
		if (!isDefaultIgnorable(codePoint) || glyph.glyph !== font.glyphIndex(codePoint)) continue;
		glyph.glyph = space;
		position.xAdvance = 0;
		position.yAdvance = 0;
		position.xOffset = 0;
		position.yOffset = 0;
	}
}
