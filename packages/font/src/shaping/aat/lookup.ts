/**
 * AAT lookup tables, the glyph-to-value maps `morx` uses for glyph classes and substitutions:
 * simple arrays (format 0), segment singles (2), segment arrays (4), single tables (6) and
 * trimmed arrays (8 and 10). Every read is bounded, so a corrupt table answers "not found".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Reader } from "../../reader.js";

/** Glyph values of a format 2, 4 or 6 table that end the search early. */
const END_OF_SEARCH = 0xffff;

/**
 * The value a lookup table holds for a glyph, `null` when the table does not cover it.
 * Formats 0 to 8 hold 16-bit values; format 10 values are 1, 2 or 4 bytes wide.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the lookup table.
 * @param glyph - Glyph index.
 * @param numGlyphs - How many glyphs the font has, which bounds a format 0 array.
 */
export function aatLookup(
	reader: Reader,
	offset: number,
	glyph: number,
	numGlyphs: number,
): number | null {
	switch (reader.u16(offset)) {
		case 0:
			return glyph < numGlyphs ? reader.u16(offset + 2 + glyph * 2) : null;
		case 2:
		case 4:
			return segmentLookup(reader, offset, glyph);
		case 6:
			return singleLookup(reader, offset, glyph);
		case 8: {
			let first = reader.u16(offset + 2);
			let count = reader.u16(offset + 4);
			if (glyph < first || glyph >= first + count) return null;
			return reader.u16(offset + 6 + (glyph - first) * 2);
		}
		case 10: {
			let size = reader.u16(offset + 2);
			let first = reader.u16(offset + 4);
			let count = reader.u16(offset + 6);
			if (glyph < first || glyph >= first + count) return null;
			return readValue(reader, offset + 8 + (glyph - first) * size, size);
		}
		default:
			return null;
	}
}

/**
 * Format 2 and 4: a binary search over `(lastGlyph, firstGlyph, value)` segments. Format 2
 * stores the value itself; format 4 stores an offset, from the table, to one value per glyph.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the lookup table.
 * @param glyph - Glyph index.
 */
function segmentLookup(reader: Reader, offset: number, glyph: number): number | null {
	let format = reader.u16(offset);
	let unitSize = reader.u16(offset + 2);
	if (unitSize < 6) return null;
	let units = unitCount(reader, offset, unitSize);
	let low = 0;
	let high = units - 1;
	while (low <= high) {
		let middle = (low + high) >> 1;
		let segment = offset + 12 + middle * unitSize;
		let last = reader.u16(segment);
		let first = reader.u16(segment + 2);
		if (first === END_OF_SEARCH && last === END_OF_SEARCH) high = middle - 1;
		else if (glyph < first) high = middle - 1;
		else if (glyph > last) low = middle + 1;
		else if (format === 2) return reader.u16(segment + 4);
		else return reader.u16(offset + reader.u16(segment + 4) + (glyph - first) * 2);
	}
	return null;
}

/**
 * Format 6: a binary search over `(glyph, value)` pairs.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the lookup table.
 * @param glyph - Glyph index.
 */
function singleLookup(reader: Reader, offset: number, glyph: number): number | null {
	let unitSize = reader.u16(offset + 2);
	if (unitSize < 4) return null;
	let units = unitCount(reader, offset, unitSize);
	let low = 0;
	let high = units - 1;
	while (low <= high) {
		let middle = (low + high) >> 1;
		let entry = offset + 12 + middle * unitSize;
		let value = reader.u16(entry);
		if (value === END_OF_SEARCH || glyph < value) high = middle - 1;
		else if (glyph > value) low = middle + 1;
		else return reader.u16(entry + 2);
	}
	return null;
}

/**
 * How many units of a binary search table the bytes hold: its `nUnits`, cut short where the
 * file ends.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the lookup table.
 * @param unitSize - Bytes per unit.
 */
function unitCount(reader: Reader, offset: number, unitSize: number): number {
	let available = Math.floor((reader.length - offset - 12) / unitSize);
	return Math.max(0, Math.min(reader.u16(offset + 4), available));
}

/**
 * An unsigned value of 1, 2 or 4 bytes; other widths read as `null`.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset.
 * @param size - Width in bytes.
 */
function readValue(reader: Reader, offset: number, size: number): number | null {
	if (size === 1) return reader.u8(offset);
	if (size === 2) return reader.u16(offset);
	if (size === 4) return reader.u32(offset);
	return null;
}
