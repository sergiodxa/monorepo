/**
 * Font subsetting, the `@sdxc/font/subset` entry: write a smaller font holding only the
 * glyphs a document draws, from TrueType, CFF or CFF2 outlines, or from a variable font
 * fixed at an instance, whose subset draws that instance with no variation tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Font } from "../font.js";

import { FontError } from "../font-error.js";
import { fontData } from "../font.js";
import { subsetFont } from "../subset.js";
import { variationOf } from "../variations/variation.js";

import { glyphOrder, subsetCff } from "./cff.js";
import { flattenedTrueType } from "./glyf-writer.js";

/**
 * Writes a smaller font holding only `glyphs`, for embedding. Glyph 0 (`.notdef`) stays 0
 * and the rest are renumbered in the order given, skipping repeats and ids the font lacks;
 * glyphs they are built from (TrueType components, `seac` accents) follow them.
 *
 * A TrueType font answers a `.ttf` and a CFF font an `.otf` whose `CFF ` table keeps the
 * source charstrings; a CFF2 font, or an `instance()` of a variable font, is drawn at its
 * location and written with fixed outlines and advances. Neither maps characters.
 *
 * @param font - A font from `parseFont`, or an instance from `@sdxc/font/variations`.
 * @param glyphs - Glyph indices of `font`.
 * @returns The subset, or a `FontError` with code `not-permitted` when
 *   `embedding.subsetting` is `false`.
 * @example let { bytes, glyphId } = unwrap(subset(font, [font.glyphIndex(65)]));
 * @example let bold = unwrap(subset(unwrap(instance(font, { wght: 700 })), glyphs));
 */
export function subset(font: Font, glyphs: Iterable<number>): Result<Font.Subset, FontError> {
	if (!font.embedding.subsetting) {
		return failure(
			new FontError(
				"not-permitted",
				"The font's license (OS/2 fsType) forbids subsetting.",
				"OS/2",
			),
		);
	}
	let data = fontData(font);
	let variation = variationOf(data);
	let order: number[];
	let bytes: Uint8Array;
	if (data.cff !== null) {
		({ bytes, order } = subsetCff({ font, data, cff: data.cff }, glyphs));
	} else if (variation !== null) {
		order = glyphOrder(data.numGlyphs, glyphs);
		bytes = flattenedTrueType(font, data, variation, order);
	} else {
		return subsetFont(data, glyphs);
	}
	let ids = new Map(order.map((original, index) => [original, index]));
	return success({ bytes, glyphs: order, glyphId: (original: number) => ids.get(original) ?? 0 });
}
