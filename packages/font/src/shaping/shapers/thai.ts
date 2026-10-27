/**
 * The Thai and Lao shaper: splits SARA AM into NIKHAHIT and SARA AA and moves the NIKHAHIT
 * before the tone marks, so the font's tone-mark rules match, and for legacy Thai fonts
 * without Thai GSUB shifts marks to their private-use variants to clear ascenders and descenders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ShapingPlan } from "../plan.js";
import type { ShapingFont } from "../shaping-font.js";

import { GlyphInfo } from "../glyph-info.js";
import { scriptOffset } from "../layout-table.js";

import { DefaultShaper } from "./default.js";

/** What a mark does to clear its neighbours in the private-use fallback. */
const ACTION = {
	/** Leaves the glyph as it is. */
	NONE: 0,
	/** Shifts the mark down. */
	DOWN: 1,
	/** Shifts the mark left. */
	LEFT: 2,
	/** Shifts the mark down and left. */
	DOWN_LEFT: 3,
	/** Removes the base consonant's descender. */
	REMOVE_DESCENDER: 4,
};

/** Consonant classes: normal, with an ascender, with a removable descender, with a strict descender, not a consonant. */
const CONSONANT = { NORMAL: 0, ASCENDER: 1, REMOVABLE: 2, DESCENDER: 3, NONE: 4 };

/** Mark classes: above-base vowel, below-base vowel, tone mark, not a mark. */
const MARK = { ABOVE: 0, BELOW: 1, TONE: 2, NONE: 3 };

/** One transition: the action for the mark and the next state. */
type Transition = readonly [number, number];

/** The above-base state each consonant class starts in; higher states hold taller stacks. */
const ABOVE_START = [0, 1, 0, 0, 3];

/** Above-base transitions by state then mark class. */
const ABOVE_STATES: readonly (readonly Transition[])[] = [
	[
		[ACTION.NONE, 3],
		[ACTION.NONE, 0],
		[ACTION.DOWN, 3],
	],
	[
		[ACTION.LEFT, 2],
		[ACTION.NONE, 1],
		[ACTION.DOWN_LEFT, 2],
	],
	[
		[ACTION.NONE, 3],
		[ACTION.NONE, 2],
		[ACTION.LEFT, 3],
	],
	[
		[ACTION.NONE, 3],
		[ACTION.NONE, 3],
		[ACTION.NONE, 3],
	],
];

/** The below-base state each consonant class starts in: no descender, removable, strict. */
const BELOW_START = [0, 0, 1, 2, 2];

/** Below-base transitions by state then mark class. */
const BELOW_STATES: readonly (readonly Transition[])[] = [
	[
		[ACTION.NONE, 0],
		[ACTION.NONE, 2],
		[ACTION.NONE, 0],
	],
	[
		[ACTION.NONE, 1],
		[ACTION.REMOVE_DESCENDER, 2],
		[ACTION.NONE, 1],
	],
	[
		[ACTION.NONE, 2],
		[ACTION.DOWN, 2],
		[ACTION.NONE, 2],
	],
];

/**
 * Private-use replacements by action: each character with its Windows then Mac private-use
 * code point, the first the font draws being used.
 */
const PRIVATE_USE_FORMS: ReadonlyMap<number, readonly (readonly [number, number, number])[]> =
	new Map([
		[
			ACTION.DOWN,
			[
				[0x0e48, 0xf70a, 0xf88b],
				[0x0e49, 0xf70b, 0xf88e],
				[0x0e4a, 0xf70c, 0xf891],
				[0x0e4b, 0xf70d, 0xf894],
				[0x0e4c, 0xf70e, 0xf897],
				[0x0e38, 0xf718, 0xf89b],
				[0x0e39, 0xf719, 0xf89c],
				[0x0e3a, 0xf71a, 0xf89d],
			],
		],
		[
			ACTION.DOWN_LEFT,
			[
				[0x0e48, 0xf705, 0xf88c],
				[0x0e49, 0xf706, 0xf88f],
				[0x0e4a, 0xf707, 0xf892],
				[0x0e4b, 0xf708, 0xf895],
				[0x0e4c, 0xf709, 0xf898],
			],
		],
		[
			ACTION.LEFT,
			[
				[0x0e48, 0xf713, 0xf88a],
				[0x0e49, 0xf714, 0xf88d],
				[0x0e4a, 0xf715, 0xf890],
				[0x0e4b, 0xf716, 0xf893],
				[0x0e4c, 0xf717, 0xf896],
				[0x0e31, 0xf710, 0xf884],
				[0x0e34, 0xf701, 0xf885],
				[0x0e35, 0xf702, 0xf886],
				[0x0e36, 0xf703, 0xf887],
				[0x0e37, 0xf704, 0xf888],
				[0x0e47, 0xf712, 0xf889],
				[0x0e4d, 0xf711, 0xf899],
			],
		],
		[
			ACTION.REMOVE_DESCENDER,
			[
				[0x0e0d, 0xf70f, 0xf89a],
				[0x0e10, 0xf700, 0xf89e],
			],
		],
	]);

/** Shapes Thai and Lao. */
export class ThaiShaper extends DefaultShaper {
	/**
	 * Normalizes, decomposes SARA AM, and runs the private-use fallback for Thai fonts whose
	 * GSUB lists no Thai script.
	 *
	 * @param plan - The plan.
	 * @param glyphs - The buffer.
	 */
	override assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]) {
		super.assignFeatures(plan, glyphs);
		decomposeSaraAm(plan.font, glyphs);
		if (plan.script === "thai" && !hasThaiGsub(plan.font)) shapePrivateUse(plan.font, glyphs);
	}
}

/**
 * Whether a code point is Thai or Lao SARA AM; the two blocks share a layout 0x80 apart.
 *
 * @param codePoint - A code point.
 */
function isSaraAm(codePoint: number): boolean {
	return (codePoint & ~0x80) === 0x0e33;
}

/**
 * Whether a code point is a Thai or Lao mark drawn above the base.
 *
 * @param codePoint - A code point.
 */
function isAboveBaseMark(codePoint: number): boolean {
	let thai = codePoint & ~0x80;
	return (
		thai === 0x0e31 ||
		(thai >= 0x0e34 && thai <= 0x0e37) ||
		(thai >= 0x0e47 && thai <= 0x0e4e) ||
		thai === 0x0e3b
	);
}

/**
 * Replaces each SARA AM with NIKHAHIT and SARA AA, both keeping its cluster and features,
 * and moves the NIKHAHIT back over the above-base marks before it.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 */
function decomposeSaraAm(font: ShapingFont, glyphs: GlyphInfo[]) {
	let index = 0;
	while (index < glyphs.length) {
		let glyph = glyphs[index];
		let codePoint = glyph?.codePoints[0] ?? 0;
		if (glyph === undefined || !isSaraAm(codePoint)) {
			index++;
			continue;
		}
		let nikhahit = codePoint - 0x0e33 + 0x0e4d;
		let saraAa = codePoint - 1;
		let make = (character: number) =>
			new GlyphInfo(font, font.glyphIndex(character), [character], glyph.cluster, glyph.features);
		let moved = make(nikhahit);
		glyphs.splice(index, 1, moved, make(saraAa));
		let target = index;
		while (target > 0 && isAboveBaseMark(glyphs[target - 1]?.codePoints[0] ?? 0)) target--;
		if (target !== index) {
			glyphs.splice(index, 1);
			glyphs.splice(target, 0, moved);
		}
		index += 2;
	}
}

/**
 * Whether the font's GSUB lists the Thai script under either of its tags.
 *
 * @param font - The shaping view.
 */
function hasThaiGsub(font: ShapingFont): boolean {
	let gsub = font.gsub;
	return gsub !== null && (scriptOffset(gsub, "thai") !== 0 || scriptOffset(gsub, "tha2") !== 0);
}

/**
 * A Thai consonant's class for the fallback.
 *
 * @param codePoint - A code point.
 */
function consonantClass(codePoint: number): number {
	if (codePoint === 0x0e1b || codePoint === 0x0e1d || codePoint === 0x0e1f) {
		return CONSONANT.ASCENDER;
	}
	if (codePoint === 0x0e0d || codePoint === 0x0e10) return CONSONANT.REMOVABLE;
	if (codePoint === 0x0e0e || codePoint === 0x0e0f) return CONSONANT.DESCENDER;
	if (codePoint >= 0x0e01 && codePoint <= 0x0e2e) return CONSONANT.NORMAL;
	return CONSONANT.NONE;
}

/**
 * A Thai mark's class for the fallback.
 *
 * @param codePoint - A code point.
 */
function markClass(codePoint: number): number {
	if (
		codePoint === 0x0e31 ||
		(codePoint >= 0x0e34 && codePoint <= 0x0e37) ||
		codePoint === 0x0e47 ||
		(codePoint >= 0x0e4d && codePoint <= 0x0e4e)
	) {
		return MARK.ABOVE;
	}
	if (codePoint >= 0x0e38 && codePoint <= 0x0e3a) return MARK.BELOW;
	if (codePoint >= 0x0e48 && codePoint <= 0x0e4c) return MARK.TONE;
	return MARK.NONE;
}

/**
 * Walks the above-base and below-base state machines over each consonant's marks and
 * redraws a mark (or the consonant, for a removed descender) with its private-use form.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 */
function shapePrivateUse(font: ShapingFont, glyphs: GlyphInfo[]) {
	let above = ABOVE_START[CONSONANT.NONE] ?? 3;
	let below = BELOW_START[CONSONANT.NONE] ?? 2;
	let base = 0;
	for (let index = 0; index < glyphs.length; index++) {
		let codePoint = glyphs[index]?.codePoints[0] ?? 0;
		let mark = markClass(codePoint);
		if (mark === MARK.NONE) {
			let consonant = consonantClass(codePoint);
			above = ABOVE_START[consonant] ?? 3;
			below = BELOW_START[consonant] ?? 2;
			base = index;
			continue;
		}
		let [aboveAction, aboveNext] = ABOVE_STATES[above]?.[mark] ?? [ACTION.NONE, above];
		let [belowAction, belowNext] = BELOW_STATES[below]?.[mark] ?? [ACTION.NONE, below];
		above = aboveNext;
		below = belowNext;
		let action = aboveAction === ACTION.NONE ? belowAction : aboveAction;
		if (action === ACTION.NONE) continue;
		let target = glyphs[action === ACTION.REMOVE_DESCENDER ? base : index];
		if (target === undefined) continue;
		let original = target.codePoints[0] ?? 0;
		let replacement = privateUseForm(font, original, action);
		if (replacement === original) continue;
		target.codePoints = [replacement];
		target.glyph = font.glyphIndex(replacement);
	}
}

/**
 * The private-use code point the font draws for a character under an action, the
 * character itself when the font has neither form.
 *
 * @param font - The shaping view.
 * @param codePoint - The mark or consonant.
 * @param action - What the state machines asked for.
 */
function privateUseForm(font: ShapingFont, codePoint: number, action: number): number {
	let entry = PRIVATE_USE_FORMS.get(action)?.find(([original]) => original === codePoint);
	if (entry === undefined) return codePoint;
	let [, windows, mac] = entry;
	if (font.glyphIndex(windows) !== 0) return windows;
	if (font.glyphIndex(mac) !== 0) return mac;
	return codePoint;
}
