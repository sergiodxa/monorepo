/**
 * The Hebrew shaper: puts meteg and below marks next to the base in a patah or qamats,
 * sheva or hiriq, meteg triplet, and composes presentation forms (letter with dagesh and
 * the like) for fonts that position no Hebrew marks with GPOS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GlyphInfo } from "../glyph-info.js";
import type { LayoutTable } from "../layout-table.js";
import type { NormalizationCharacter } from "../normalize.js";
import type { ShapingPlan } from "../plan.js";

import { feature, languageSystem, languageTags, scriptOffset } from "../layout-table.js";
import { combiningClass } from "../unicode/properties.js";

import { DefaultShaper } from "./default.js";

/** Presentation forms with dagesh by letter; letters without an encoded form are absent. */
const DAGESH_FORMS: ReadonlyMap<number, number> = new Map([
	[0x05d0, 0xfb30],
	[0x05d1, 0xfb31],
	[0x05d2, 0xfb32],
	[0x05d3, 0xfb33],
	[0x05d4, 0xfb34],
	[0x05d5, 0xfb35],
	[0x05d6, 0xfb36],
	[0x05d8, 0xfb38],
	[0x05d9, 0xfb39],
	[0x05da, 0xfb3a],
	[0x05db, 0xfb3b],
	[0x05dc, 0xfb3c],
	[0x05de, 0xfb3e],
	[0x05e0, 0xfb40],
	[0x05e1, 0xfb41],
	[0x05e3, 0xfb43],
	[0x05e4, 0xfb44],
	[0x05e6, 0xfb46],
	[0x05e7, 0xfb47],
	[0x05e8, 0xfb48],
	[0x05e9, 0xfb49],
	[0x05ea, 0xfb4a],
]);

/**
 * Presentation forms outside canonical composition, by mark then base: the pairs a font
 * draws as one glyph when it cannot place the mark itself.
 */
const PRESENTATION_FORMS: ReadonlyMap<number, ReadonlyMap<number, number>> = new Map([
	[0x05b4, new Map([[0x05d9, 0xfb1d]])],
	[
		0x05b7,
		new Map([
			[0x05f2, 0xfb1f],
			[0x05d0, 0xfb2e],
		]),
	],
	[0x05b8, new Map([[0x05d0, 0xfb2f]])],
	[0x05b9, new Map([[0x05d5, 0xfb4b]])],
	[0x05bc, new Map([...DAGESH_FORMS, [0xfb2a, 0xfb2c], [0xfb2b, 0xfb2d]])],
	[
		0x05bf,
		new Map([
			[0x05d1, 0xfb4c],
			[0x05db, 0xfb4d],
			[0x05e4, 0xfb4e],
		]),
	],
	[
		0x05c1,
		new Map([
			[0x05e9, 0xfb2a],
			[0xfb49, 0xfb2c],
		]),
	],
	[
		0x05c2,
		new Map([
			[0x05e9, 0xfb2b],
			[0xfb49, 0xfb2d],
		]),
	],
]);

/** Combining classes of the marks below the base that settle beside it like meteg. */
const BELOW_CLASSES = new Set([202, 218, 220, 222]);

/** Shapes Hebrew: mark order for meteg, and presentation forms for fonts without GPOS marks. */
export class HebrewShaper extends DefaultShaper {
	/**
	 * In a patah or qamats, sheva or hiriq, meteg or below-mark triplet, swaps the last two so
	 * the meteg sits beside the vowel, as Hebrew fonts expect; only the first triplet moves.
	 *
	 * @param characters - The cluster's characters, marks sorted by combining class.
	 * @param start - Index of the run's first mark.
	 * @param end - One past its last mark.
	 */
	override reorderMarks(characters: NormalizationCharacter[], start: number, end: number) {
		for (let index = start + 2; index < end; index++) {
			let first = characters[index - 2];
			let second = characters[index - 1];
			let third = characters[index];
			if (first === undefined || second === undefined || third === undefined) continue;
			if (!isPatahOrQamats(first.codePoint)) continue;
			if (!isShevaOrHiriq(second.codePoint) || !isMetegOrBelow(third.codePoint)) continue;
			characters[index - 1] = third;
			characters[index] = second;
			return;
		}
	}

	/**
	 * Normalizes, then composes presentation forms when the font has no GPOS `mark` feature
	 * under the Hebrew script to place the marks with.
	 *
	 * @param plan - The plan.
	 * @param glyphs - The buffer.
	 */
	override assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]) {
		super.assignFeatures(plan, glyphs);
		let gpos = plan.font.gpos;
		if (gpos !== null && hasScriptFeature(gpos, "hebr", "mark")) return;
		composePresentationForms(plan, glyphs);
	}
}

/**
 * Replaces each base and the marks after it with their presentation form while the font
 * draws one, chaining through several marks (shin, shin dot, then dagesh).
 *
 * @param plan - The plan, for the font.
 * @param glyphs - The buffer.
 */
function composePresentationForms(plan: ShapingPlan, glyphs: GlyphInfo[]) {
	let font = plan.font;
	for (let index = 0; index + 1 < glyphs.length; index++) {
		let base = glyphs[index];
		if (base === undefined) continue;
		let composed = base.codePoints[0] ?? 0;
		let consumed = 1;
		while (index + consumed < glyphs.length) {
			let mark = glyphs[index + consumed]?.codePoints[0] ?? 0;
			let form = PRESENTATION_FORMS.get(mark)?.get(composed);
			if (form === undefined || font.glyphIndex(form) === 0) break;
			composed = form;
			consumed++;
		}
		if (consumed === 1) continue;
		let parts = glyphs.slice(index, index + consumed);
		base.codePoints = parts.flatMap((glyph) => glyph.codePoints);
		base.glyph = font.glyphIndex(composed);
		glyphs.splice(index + 1, consumed - 1);
	}
}

/**
 * Whether a layout table enables a feature in any language system of a script.
 *
 * @param table - A GSUB or GPOS table.
 * @param script - An OpenType script tag.
 * @param tag - A feature tag.
 */
function hasScriptFeature(table: LayoutTable, script: string, tag: string): boolean {
	let offset = scriptOffset(table, script);
	if (offset === 0) return false;
	let systems = [null, ...languageTags(table, offset)].map((language) =>
		languageSystem(table, offset, language),
	);
	return systems.some(
		(system) =>
			system !== null && system.featureIndices.some((index) => feature(table, index)?.tag === tag),
	);
}

/**
 * Patah or qamats, the first mark of the triplet.
 *
 * @param codePoint - A code point.
 */
function isPatahOrQamats(codePoint: number): boolean {
	return codePoint === 0x05b7 || codePoint === 0x05b8;
}

/**
 * Sheva or hiriq, the middle mark of the triplet.
 *
 * @param codePoint - A code point.
 */
function isShevaOrHiriq(codePoint: number): boolean {
	return codePoint === 0x05b0 || codePoint === 0x05b4;
}

/**
 * Meteg or a mark below the base, the last mark of the triplet.
 *
 * @param codePoint - A code point.
 */
function isMetegOrBelow(codePoint: number): boolean {
	return codePoint === 0x05bd || BELOW_CLASSES.has(combiningClass(codePoint));
}
