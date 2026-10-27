/**
 * Kerning from the legacy `kern` table, for fonts whose GPOS has no `kern` feature: the
 * Microsoft version 0 table and Apple's version 1, with pair lists (format 0), class arrays
 * (format 2) and class indices (format 3), summed across horizontal subtables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRecord } from "../font.js";
import type { Reader } from "../reader.js";

/** A horizontal kerning subtable located in the table. */
interface KernSubtable {
	format: number;
	/** Absolute offset of the subtable header; format 2 offsets are relative to it. */
	start: number;
	/** Absolute offset of the format-specific data after the header. */
	data: number;
	/** Whether the value replaces the sum of earlier subtables instead of adding to it. */
	override: boolean;
}

/** Each `kern` table's subtables, located once per table. */
const SUBTABLES = new WeakMap<Reader, Map<number, KernSubtable[]>>();

/**
 * The horizontal subtables of a `kern` table; cross-stream, vertical, minimum and
 * variation subtables describe other adjustments and are left out.
 *
 * @param reader - The font bytes.
 * @param record - The `kern` table's directory entry.
 */
function kernSubtables(reader: Reader, record: TableRecord): KernSubtable[] {
	let byOffset = SUBTABLES.get(reader) ?? new Map<number, KernSubtable[]>();
	SUBTABLES.set(reader, byOffset);
	let cached = byOffset.get(record.offset);
	if (cached !== undefined) return cached;
	let { offset, length } = record;
	let end = offset + length;
	let subtables: KernSubtable[] = [];
	let apple = reader.u16(offset) === 1;
	let count = apple ? reader.u32(offset + 4) : reader.u16(offset + 2);
	let at = offset + (apple ? 8 : 4);
	for (let index = 0; index < count && at < end; index++) {
		if (apple) {
			let size = reader.u32(at);
			let coverage = reader.u16(at + 4);
			if ((coverage & 0xe000) === 0) {
				subtables.push({ format: coverage & 0xff, start: at, data: at + 8, override: false });
			}
			if (size < 8) break;
			at += size;
			continue;
		}
		let size = reader.u16(at + 2);
		let coverage = reader.u16(at + 4);
		if ((coverage & 0x07) === 0x01) {
			subtables.push({
				format: coverage >> 8,
				start: at,
				data: at + 6,
				override: (coverage & 0x08) !== 0,
			});
		}
		if (size < 6) break;
		at += size;
	}
	byOffset.set(record.offset, subtables);
	return subtables;
}

/**
 * The kerning between two glyphs in font units, `0` when no subtable adjusts the pair.
 *
 * @param reader - The font bytes.
 * @param record - The `kern` table's directory entry.
 * @param left - The glyph drawn first.
 * @param right - The glyph drawn next.
 */
export function kernPair(reader: Reader, record: TableRecord, left: number, right: number): number {
	let total = 0;
	for (let subtable of kernSubtables(reader, record)) {
		let value = subtableValue(reader, subtable, left, right);
		total = subtable.override ? value : total + value;
	}
	return total;
}

/**
 * One subtable's value for a pair.
 *
 * @param reader - The font bytes.
 * @param subtable - The subtable.
 * @param left - The glyph drawn first.
 * @param right - The glyph drawn next.
 */
function subtableValue(
	reader: Reader,
	subtable: KernSubtable,
	left: number,
	right: number,
): number {
	let { data, start } = subtable;
	if (subtable.format === 0) {
		let key = left * 0x10000 + right;
		let low = 0;
		let high = reader.u16(data) - 1;
		while (low <= high) {
			let middle = (low + high) >> 1;
			let pair = data + 8 + middle * 6;
			let found = reader.u16(pair) * 0x10000 + reader.u16(pair + 2);
			if (found === key) return reader.i16(pair + 4);
			if (found < key) low = middle + 1;
			else high = middle - 1;
		}
		return 0;
	}
	if (subtable.format === 2) {
		let leftTable = start + reader.u16(data + 2);
		let rightTable = start + reader.u16(data + 4);
		let array = reader.u16(data + 6);
		let leftOffset = classOffset(reader, leftTable, left, array);
		let rightOffset = classOffset(reader, rightTable, right, 0);
		return reader.i16(start + leftOffset + rightOffset);
	}
	if (subtable.format === 3) {
		let glyphs = reader.u16(data);
		if (left >= glyphs || right >= glyphs) return 0;
		let values = reader.u8(data + 2);
		let leftClasses = reader.u8(data + 3);
		let rightClasses = reader.u8(data + 4);
		let classes = data + 6 + values * 2;
		let leftClass = reader.u8(classes + left);
		let rightClass = reader.u8(classes + glyphs + right);
		if (leftClass >= leftClasses || rightClass >= rightClasses) return 0;
		let kernIndex = reader.u8(classes + glyphs * 2 + leftClass * rightClasses + rightClass);
		return kernIndex < values ? reader.i16(data + 6 + kernIndex * 2) : 0;
	}
	return 0;
}

/**
 * A glyph's byte offset in a format 2 class table, or the fallback for a glyph outside it.
 *
 * @param reader - The font bytes.
 * @param table - Absolute offset of the class table.
 * @param glyph - Glyph index.
 * @param fallback - What a glyph the table does not list contributes.
 */
function classOffset(reader: Reader, table: number, glyph: number, fallback: number): number {
	let first = reader.u16(table);
	let count = reader.u16(table + 2);
	let index = glyph - first;
	return index >= 0 && index < count ? reader.u16(table + 4 + index * 2) : fallback;
}
