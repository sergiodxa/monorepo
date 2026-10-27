/**
 * Lookups that read straight from a font's bytes on each call: `kern` format 0 pairs and
 * GPOS pair adjustments. Each one binary-searches the sorted arrays the format guarantees,
 * so a font costs nothing to open and a lookup stays logarithmic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Reader } from "./reader.js";

/** GPOS `PairPos` subtables grouped by the lookup that owns them, in lookup order. */
export type PairLookups = number[][];

/** XAdvance's bit in a GPOS ValueFormat; the two placement bits precede it in the record. */
const VALUE_X_ADVANCE = 0x0004;

/**
 * Sums the horizontal format 0 subtables of a version 0 `kern` table for one pair. Minimum
 * and cross-stream subtables describe other adjustments and are skipped.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the `kern` table.
 * @param left - First glyph.
 * @param right - Second glyph.
 * @returns The adjustment in font units, `0` when no subtable lists the pair.
 */
export function kernTablePair(reader: Reader, offset: number, left: number, right: number): number {
	if (reader.u16(offset) !== 0) return 0;
	let tables = reader.u16(offset + 2);
	let subtable = offset + 4;
	let total = 0;
	let key = left * 0x10000 + right;
	for (let index = 0; index < tables; index++) {
		let length = reader.u16(subtable + 2);
		let coverage = reader.u16(subtable + 4);
		if (coverage >> 8 === 0 && (coverage & 0x07) === 0x01) {
			let pairs = reader.u16(subtable + 6);
			let low = 0;
			let high = pairs - 1;
			while (low <= high) {
				let middle = (low + high) >> 1;
				let pair = subtable + 14 + middle * 6;
				let candidate = reader.u16(pair) * 0x10000 + reader.u16(pair + 2);
				if (candidate < key) low = middle + 1;
				else if (candidate > key) high = middle - 1;
				else {
					total += reader.i16(pair + 4);
					break;
				}
			}
		}
		if (length === 0) break;
		subtable += length;
	}
	return total;
}

/**
 * Finds every `PairPos` subtable reachable from a GPOS `kern` feature, unwrapping extension
 * lookups. Features are taken from every script, which suits the horizontal Latin text the
 * layout handles.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the `GPOS` table.
 */
export function gposPairLookups(reader: Reader, offset: number): PairLookups {
	let features = offset + reader.u16(offset + 6);
	let lookups = offset + reader.u16(offset + 8);
	let lookupCount = reader.u16(lookups);
	let indices = new Set<number>();
	let featureCount = reader.u16(features);
	for (let index = 0; index < featureCount; index++) {
		let record = features + 2 + index * 6;
		if (reader.tag(record) !== "kern") continue;
		let feature = features + reader.u16(record + 4);
		let count = reader.u16(feature + 2);
		for (let entry = 0; entry < count; entry++) {
			let lookup = reader.u16(feature + 4 + entry * 2);
			if (lookup < lookupCount) indices.add(lookup);
		}
	}

	let result: PairLookups = [];
	for (let index of [...indices].sort((a, b) => a - b)) {
		let lookup = lookups + reader.u16(lookups + 2 + index * 2);
		let type = reader.u16(lookup);
		let count = reader.u16(lookup + 4);
		let subtables: number[] = [];
		for (let entry = 0; entry < count; entry++) {
			let subtable = lookup + reader.u16(lookup + 6 + entry * 2);
			if (type === 9 && reader.u16(subtable + 2) === 2) {
				subtables.push(subtable + reader.u32(subtable + 4));
			} else if (type === 2) {
				subtables.push(subtable);
			}
		}
		if (subtables.length > 0) result.push(subtables);
	}
	return result;
}

/**
 * The first glyph's x-advance adjustment for a pair, summed across lookups; within one
 * lookup the first subtable that covers the first glyph decides, as GPOS applies it.
 *
 * @param reader - The font bytes.
 * @param lookups - From `gposPairLookups`.
 * @param left - First glyph.
 * @param right - Second glyph.
 * @returns The adjustment in font units.
 */
export function gposPair(
	reader: Reader,
	lookups: PairLookups,
	left: number,
	right: number,
): number {
	let total = 0;
	for (let subtables of lookups) {
		for (let subtable of subtables) {
			let value = pairPosValue(reader, subtable, left, right);
			if (value !== null) {
				total += value;
				break;
			}
		}
	}
	return total;
}

/**
 * One `PairPos` subtable's answer: `null` when it does not apply to the pair, so the next
 * subtable of the lookup gets its turn.
 *
 * @param reader - The font bytes.
 * @param subtable - Absolute offset of the subtable.
 * @param left - First glyph.
 * @param right - Second glyph.
 */
function pairPosValue(
	reader: Reader,
	subtable: number,
	left: number,
	right: number,
): number | null {
	let format = reader.u16(subtable);
	let coverage = coverageIndex(reader, subtable + reader.u16(subtable + 2), left);
	if (coverage < 0) return null;
	let format1 = reader.u16(subtable + 4);
	let format2 = reader.u16(subtable + 6);
	let size1 = valueRecordSize(format1);
	let size2 = valueRecordSize(format2);
	let advance = xAdvanceOffset(format1);

	if (format === 1) {
		if (coverage >= reader.u16(subtable + 8)) return null;
		let set = subtable + reader.u16(subtable + 10 + coverage * 2);
		let count = reader.u16(set);
		let stride = 2 + size1 + size2;
		let low = 0;
		let high = count - 1;
		while (low <= high) {
			let middle = (low + high) >> 1;
			let record = set + 2 + middle * stride;
			let second = reader.u16(record);
			if (second < right) low = middle + 1;
			else if (second > right) high = middle - 1;
			else return advance < 0 ? 0 : reader.i16(record + 2 + advance);
		}
		return null;
	}

	if (format === 2) {
		let class1 = classOf(reader, subtable + reader.u16(subtable + 8), left);
		let class2 = classOf(reader, subtable + reader.u16(subtable + 10), right);
		let class1Count = reader.u16(subtable + 12);
		let class2Count = reader.u16(subtable + 14);
		if (class1 >= class1Count || class2 >= class2Count) return null;
		if (advance < 0) return 0;
		let record = subtable + 16 + (class1 * class2Count + class2) * (size1 + size2);
		return reader.i16(record + advance);
	}

	return null;
}

/**
 * Bytes in a ValueRecord: two per set bit of its format.
 *
 * @param format - A GPOS ValueFormat.
 */
function valueRecordSize(format: number): number {
	let size = 0;
	for (let bits = format; bits !== 0; bits >>= 1) size += (bits & 1) * 2;
	return size;
}

/**
 * Where XAdvance sits inside a ValueRecord, or `-1` when the record carries none.
 *
 * @param format - A GPOS ValueFormat.
 */
function xAdvanceOffset(format: number): number {
	if (!(format & VALUE_X_ADVANCE)) return -1;
	return ((format & 1) + ((format >> 1) & 1)) * 2;
}

/**
 * A glyph's index in a Coverage table, `-1` when it is not covered.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the Coverage table.
 * @param glyph - The glyph to find.
 */
function coverageIndex(reader: Reader, offset: number, glyph: number): number {
	let format = reader.u16(offset);
	let count = reader.u16(offset + 2);
	let low = 0;
	let high = count - 1;
	if (format === 1) {
		while (low <= high) {
			let middle = (low + high) >> 1;
			let candidate = reader.u16(offset + 4 + middle * 2);
			if (candidate < glyph) low = middle + 1;
			else if (candidate > glyph) high = middle - 1;
			else return middle;
		}
	} else if (format === 2) {
		while (low <= high) {
			let middle = (low + high) >> 1;
			let range = offset + 4 + middle * 6;
			if (glyph < reader.u16(range)) high = middle - 1;
			else if (glyph > reader.u16(range + 2)) low = middle + 1;
			else return reader.u16(range + 4) + glyph - reader.u16(range);
		}
	}
	return -1;
}

/**
 * A glyph's class in a ClassDef table; glyphs the table does not list are class 0.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the ClassDef table.
 * @param glyph - The glyph to classify.
 */
function classOf(reader: Reader, offset: number, glyph: number): number {
	let format = reader.u16(offset);
	if (format === 1) {
		let start = reader.u16(offset + 2);
		let count = reader.u16(offset + 4);
		if (glyph < start || glyph >= start + count) return 0;
		return reader.u16(offset + 6 + (glyph - start) * 2);
	}
	if (format === 2) {
		let low = 0;
		let high = reader.u16(offset + 2) - 1;
		while (low <= high) {
			let middle = (low + high) >> 1;
			let range = offset + 4 + middle * 6;
			if (glyph < reader.u16(range)) high = middle - 1;
			else if (glyph > reader.u16(range + 2)) low = middle + 1;
			else return reader.u16(range + 4);
		}
	}
	return 0;
}
