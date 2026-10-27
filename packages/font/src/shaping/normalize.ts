/**
 * Canonical normalization against the font's coverage before GSUB: each base and its
 * combining marks are decomposed, the marks put in shaping order, and the result recomposed
 * wherever the font draws the composite, so decomposed and precomposed text shape alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { combiningClass, isMark } from "./unicode/properties.js";

/** A character during normalization, with the combining class marks are ordered by. */
export interface NormalizationCharacter {
	codePoint: number;
	combiningClass: number;
}

/**
 * Reorders a run of marks in place after they are sorted by combining class; a script
 * shaper supplies one when its fonts expect another order.
 *
 * @param characters - The cluster's characters.
 * @param start - Index of the run's first mark.
 * @param end - One past its last mark.
 */
export type MarkReorder = (
	characters: NormalizationCharacter[],
	start: number,
	end: number,
) => void;

/**
 * Combining classes remapped so marks sort the way fonts expect: Hebrew points in the order
 * the SBL Hebrew manual gives, Arabic shadda before the vowels, Telugu length marks and Thai
 * sara u and uu before the virama, Tibetan sign u before sign i.
 */
const MODIFIED_CLASSES: ReadonlyMap<number, number> = new Map([
	[10, 22],
	[11, 15],
	[12, 16],
	[13, 17],
	[14, 23],
	[15, 18],
	[16, 19],
	[17, 20],
	[18, 21],
	[19, 14],
	[20, 24],
	[21, 12],
	[22, 25],
	[23, 13],
	[24, 10],
	[25, 11],
	[27, 28],
	[28, 29],
	[29, 30],
	[30, 31],
	[31, 32],
	[32, 33],
	[33, 27],
	[84, 4],
	[91, 5],
	[103, 3],
	[130, 132],
	[132, 131],
]);

/** Tai Tham sakot and Tibetan padma sort after every other mark, Tibetan tsa-phru before the vowels. */
const MODIFIED_CLASSES_BY_CODE_POINT: ReadonlyMap<number, number> = new Map([
	[0x1a60, 254],
	[0x0fc6, 254],
	[0x0f39, 127],
]);

/**
 * A character with the combining class shaping orders it by.
 *
 * @param codePoint - A code point.
 */
export function normalizationCharacter(codePoint: number): NormalizationCharacter {
	let base = combiningClass(codePoint);
	let modified =
		MODIFIED_CLASSES_BY_CODE_POINT.get(codePoint) ?? MODIFIED_CLASSES.get(base) ?? base;
	return { codePoint, combiningClass: modified };
}

/**
 * Normalizes one cluster (a base and the marks that follow it) for a font: decomposes each
 * character when the font draws every part, sorts the marks, then composes pairs the font
 * has a glyph for. A character the font draws whole is kept as it is.
 *
 * @param codePoints - The cluster, base first.
 * @param hasGlyph - Whether the font maps a code point to a glyph.
 * @param reorder - The shaper's extra mark ordering.
 * @returns The cluster's characters after normalization.
 */
export function normalizeCluster(
	codePoints: readonly number[],
	hasGlyph: (codePoint: number) => boolean,
	reorder: MarkReorder = () => {},
): number[] {
	let first = codePoints[0];
	if (codePoints.length === 1 && first !== undefined && hasGlyph(first)) return [first];
	let covered = (character: NormalizationCharacter) => hasGlyph(character.codePoint);
	let decomposed: NormalizationCharacter[] = [];
	for (let codePoint of codePoints) {
		let parts = Array.from(String.fromCodePoint(codePoint).normalize("NFD"), (character) =>
			normalizationCharacter(character.codePointAt(0) ?? 0),
		);
		if (!parts.every(covered)) {
			parts = recompose(parts, hasGlyph);
			if (!parts.every(covered)) parts = [normalizationCharacter(codePoint)];
		}
		decomposed.push(...parts);
	}
	for (let start = 0; start < decomposed.length; start++) {
		if ((decomposed[start]?.combiningClass ?? 0) === 0) continue;
		let end = start + 1;
		while (end < decomposed.length && (decomposed[end]?.combiningClass ?? 0) > 0) end++;
		let marks = decomposed.slice(start, end);
		marks.sort((a, b) => a.combiningClass - b.combiningClass);
		decomposed.splice(start, marks.length, ...marks);
		reorder(decomposed, start, end);
		start = end;
	}
	return recompose(decomposed, hasGlyph).map((character) => character.codePoint);
}

/**
 * Composes each mark onto the last starter when Unicode composes the pair and the font
 * draws the result; a mark blocked by an earlier mark of the same or higher class stays.
 *
 * @param characters - Characters in canonical order.
 * @param hasGlyph - Whether the font maps a code point to a glyph.
 */
function recompose(
	characters: readonly NormalizationCharacter[],
	hasGlyph: (codePoint: number) => boolean,
): NormalizationCharacter[] {
	let result: NormalizationCharacter[] = [];
	let starter = 0;
	let lastClass = 0;
	for (let character of characters) {
		let { codePoint } = character;
		let base = result[starter];
		if (
			base !== undefined &&
			isMark(codePoint) &&
			(lastClass === 0 || lastClass < character.combiningClass)
		) {
			let composite = Array.from(String.fromCodePoint(base.codePoint, codePoint).normalize("NFC"));
			let composed = composite[0]?.codePointAt(0);
			if (composite.length === 1 && composed !== undefined && hasGlyph(composed)) {
				result[starter] = { codePoint: composed, combiningClass: base.combiningClass };
				continue;
			}
		}
		if (character.combiningClass === 0) starter = result.length;
		result.push({ ...character });
		lastClass = character.combiningClass;
	}
	return result;
}
