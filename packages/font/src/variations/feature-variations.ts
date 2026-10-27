/**
 * GSUB and GPOS `FeatureVariations`: which features a variable font swaps for alternate
 * feature tables at a point in its design space. The shaping engine asks once per font and
 * table, and reads each substituted feature index's lookups from the alternate table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "../font.js";
import type { Reader } from "../reader.js";

import { fontData } from "../font.js";

import { readAxes } from "./fvar.js";
import { variationOf } from "./variation.js";

/**
 * The feature substitutions of a font's GSUB or GPOS at the font's own location: an
 * instance's coordinates, or the default location (all `0`) for a font `instance` did not
 * produce. Each entry maps a FeatureList index to the absolute offset of its alternate
 * Feature table in the font's bytes; features absent from the map keep their own table.
 *
 * @param font - A font, instanced or not.
 * @param tag - The layout table to read.
 * @example featureVariationSubstitutions(font, "GSUB").get(featureIndex) ?? defaultOffset
 */
export function featureVariationSubstitutions(
	font: Font,
	tag: "GSUB" | "GPOS",
): Map<number, number> {
	let data = fontData(font);
	let table = data.tables.get(tag);
	if (table === undefined) return new Map();
	let coords = variationOf(data)?.coords ?? readAxes(data.reader, data.tables).map(() => 0);
	return readFeatureSubstitutions(data.reader, table.offset, table.length, coords);
}

/**
 * The substitutions of the first FeatureVariation record whose condition set holds at
 * `coords`, as the format requires; a table older than version 1.1 answers none.
 *
 * @param reader - The whole file.
 * @param offset - Absolute offset of the GSUB or GPOS table.
 * @param length - Its length in bytes.
 * @param coords - Normalized coordinates, `fvar` axis order.
 */
export function readFeatureSubstitutions(
	reader: Reader,
	offset: number,
	length: number,
	coords: readonly number[],
): Map<number, number> {
	let substitutions = new Map<number, number>();
	if (length < 14 || reader.u16(offset) !== 1 || reader.u16(offset + 2) < 1) return substitutions;
	let relative = reader.u32(offset + 10);
	if (relative === 0) return substitutions;
	let start = offset + relative;
	let end = offset + length;
	let count = reader.u32(start + 4);
	for (let index = 0; index < count; index++) {
		let record = start + 8 + index * 8;
		if (record + 8 > end) break;
		let conditions = reader.u32(record);
		if (conditions !== 0 && !conditionSetHolds(reader, start + conditions, coords)) continue;
		let substitution = reader.u32(record + 4);
		if (substitution === 0) return substitutions;
		let table = start + substitution;
		let substitutionCount = reader.u16(table + 4);
		for (let entry = 0; entry < substitutionCount; entry++) {
			let at = table + 6 + entry * 6;
			if (at + 6 > end) break;
			substitutions.set(reader.u16(at), table + reader.u32(at + 2));
		}
		return substitutions;
	}
	return substitutions;
}

/**
 * Whether every condition of a set holds: each format 1 condition requires one axis's
 * coordinate to lie within its range, and a condition of an unknown format fails the set.
 *
 * @param reader - The whole file.
 * @param offset - Absolute offset of the ConditionSet.
 * @param coords - Normalized coordinates.
 */
function conditionSetHolds(reader: Reader, offset: number, coords: readonly number[]): boolean {
	let count = reader.u16(offset);
	for (let index = 0; index < count; index++) {
		let condition = offset + reader.u32(offset + 2 + index * 4);
		if (reader.u16(condition) !== 1) return false;
		let value = coords[reader.u16(condition + 2)] ?? 0;
		if (value < reader.f2dot14(condition + 4) || value > reader.f2dot14(condition + 6)) {
			return false;
		}
	}
	return true;
}
