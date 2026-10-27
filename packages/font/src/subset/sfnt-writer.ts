/**
 * The sfnt pieces every subset writes the same way whatever its outline format: the file
 * layout with its checksums, and the `head`, `hhea`, `hmtx`, `post` and `cmap` tables rebuilt
 * for the subset's glyph count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font, FontData } from "../font.js";
import type { Reader } from "../reader.js";

/** Bytes of one table, ready to be placed in the file. */
export interface TableBytes {
	tag: string;
	bytes: Uint8Array;
}

/** One `hmtx` entry: advance width and left side bearing, in font units. */
export interface HorizontalMetric {
	advance: number;
	bearing: number;
}

/** `sfntVersion` of a font with CFF outlines, the bytes `OTTO`. */
export const OPENTYPE_CFF = 0x4f54544f;

/** `head.checkSumAdjustment` makes the whole file's u32 sum equal this. */
const CHECKSUM_MAGIC = 0xb1b0afba;

/**
 * Lays out the sfnt: a directory sorted by tag, every table 4-byte aligned and zero-padded and
 * checksummed over its padded bytes, then `head.checkSumAdjustment` set from the whole file.
 *
 * @param tables - Tables in any order; `head` must have its adjustment zeroed.
 * @param version - The `sfntVersion` the file starts with.
 */
export function assemble(tables: readonly TableBytes[], version: number): Uint8Array {
	let sorted = [...tables].sort((left, right) => (left.tag < right.tag ? -1 : 1));
	let count = sorted.length;
	let directorySize = 12 + count * 16;
	let size = sorted.reduce((total, table) => total + align(table.bytes.length), directorySize);
	let file = new Uint8Array(size);
	let view = new DataView(file.buffer);

	let selector = Math.floor(Math.log2(count));
	let searchRange = 2 ** selector * 16;
	view.setUint32(0, version);
	view.setUint16(4, count);
	view.setUint16(6, searchRange);
	view.setUint16(8, selector);
	view.setUint16(10, count * 16 - searchRange);

	let offset = directorySize;
	let headOffset = -1;
	sorted.forEach((table, index) => {
		let record = 12 + index * 16;
		file.set(table.bytes, offset);
		for (let char = 0; char < 4; char++) view.setUint8(record + char, table.tag.charCodeAt(char));
		view.setUint32(record + 4, checksum(view, offset, align(table.bytes.length)));
		view.setUint32(record + 8, offset);
		view.setUint32(record + 12, table.bytes.length);
		if (table.tag === "head" && table.bytes.length >= 12) headOffset = offset;
		offset += align(table.bytes.length);
	});
	if (headOffset >= 0) {
		view.setUint32(headOffset + 8, (CHECKSUM_MAGIC - checksum(view, 0, size)) >>> 0);
	}
	return file;
}

/**
 * `head` with `checkSumAdjustment` zeroed, the value its own checksum is computed with before
 * `assemble` fills it in.
 *
 * @param data - The source font.
 */
export function headTable(data: FontData): Uint8Array {
	let head = copyTable(data, "head");
	if (head.length >= 12) new DataView(head.buffer).setUint32(8, 0);
	return head;
}

/**
 * `hhea` with `numberOfHMetrics` set to the subset's glyph count, since `hmtxTable` writes a
 * full metric for every glyph. An instance's line metrics replace the stored ones, so the
 * subset keeps what the instance's `MVAR` varied once that table is dropped.
 *
 * @param data - The source font.
 * @param count - Glyphs in the subset.
 * @param instance - The instanced font whose metrics to write, `null` to keep the source's.
 */
export function hheaTable(data: FontData, count: number, instance: Font | null): Uint8Array {
	let hhea = patchU16(copyTable(data, "hhea"), 34, count);
	if (instance === null) return hhea;
	patchU16(hhea, 4, toI16(instance.ascender));
	patchU16(hhea, 6, toI16(instance.descender));
	return patchU16(hhea, 8, toI16(instance.lineGap));
}

/**
 * A signed value as the u16 bit pattern of its rounded, clamped i16.
 *
 * @param value - Font units.
 */
function toI16(value: number): number {
	return clamp(Math.round(value), -0x8000, 0x7fff) & 0xffff;
}

/**
 * `maxp` version 0.5, the form a font with CFF outlines carries: version and glyph count.
 *
 * @param count - Glyphs in the subset.
 */
export function maxpCffTable(count: number): Uint8Array {
	let bytes = new Uint8Array(6);
	let view = new DataView(bytes.buffer);
	view.setUint32(0, 0x00005000);
	view.setUint16(4, count);
	return bytes;
}

/**
 * The source's `hmtx` entry for a glyph. A glyph past `numberOfHMetrics` takes the last
 * advance and its own trailing bearing, `0` when the source `hmtx` is too short to hold it.
 *
 * @param data - The source font.
 * @param glyph - Original glyph id.
 */
export function sourceMetric(data: FontData, glyph: number): HorizontalMetric {
	let { reader, hmtxOffset, numberOfHMetrics } = data;
	let hmtxEnd = hmtxOffset + (data.tables.get("hmtx")?.length ?? 0);
	let advance = reader.u16(hmtxOffset + Math.max(Math.min(glyph, numberOfHMetrics - 1), 0) * 4);
	let bearingOffset =
		glyph < numberOfHMetrics
			? hmtxOffset + glyph * 4 + 2
			: hmtxOffset + numberOfHMetrics * 4 + (glyph - numberOfHMetrics) * 2;
	let bearing = bearingOffset + 2 <= hmtxEnd ? reader.i16(bearingOffset) : 0;
	return { advance, bearing };
}

/**
 * One full metric per subset glyph, so `hhea.numberOfHMetrics` equals the glyph count.
 * Values are rounded and clamped to the u16 advance and i16 bearing fields.
 *
 * @param metrics - Each subset glyph's metric, by new id.
 */
export function hmtxTable(metrics: readonly HorizontalMetric[]): Uint8Array {
	let bytes = new Uint8Array(metrics.length * 4);
	let view = new DataView(bytes.buffer);
	metrics.forEach(({ advance, bearing }, index) => {
		view.setUint16(index * 4, clamp(Math.round(advance), 0, 0xffff));
		view.setInt16(index * 4 + 2, clamp(Math.round(bearing), -0x8000, 0x7fff));
	});
	return bytes;
}

/**
 * `post` format 3: the source's metrics header (italic angle, underline, fixed pitch) with no
 * glyph names, which would otherwise need renumbering; a font without `post` gets zeros.
 *
 * @param data - The source font.
 */
export function postTable(data: FontData): Uint8Array {
	let bytes = new Uint8Array(32);
	let post = data.tables.get("post");
	if (post !== undefined) copyBytes(data.reader, post.offset, Math.min(post.length, 32), bytes, 0);
	new DataView(bytes.buffer).setUint32(0, 0x00030000);
	return bytes;
}

/**
 * A Windows Unicode `cmap` whose only format 4 segment is the mandatory 0xFFFF terminator, so
 * it maps no characters yet satisfies parsers and sanitizers that require a Unicode subtable.
 */
export function emptyCmap(): Uint8Array {
	let bytes = new Uint8Array(36);
	let view = new DataView(bytes.buffer);
	let fields = [0, 1, 3, 1, 0, 12, 4, 24, 0, 2, 2, 0, 0, 0xffff, 0, 0xffff, 1, 0];
	fields.forEach((value, index) => view.setUint16(index * 2, value));
	return bytes;
}

/**
 * A fresh copy of a source table, so patching it leaves the source font untouched; an absent
 * table copies as empty.
 *
 * @param data - The source font.
 * @param tag - Table tag.
 */
export function copyTable(data: FontData, tag: string): Uint8Array {
	let table = data.tables.get(tag);
	if (table === undefined) return new Uint8Array();
	let bytes = new Uint8Array(table.length);
	copyBytes(data.reader, table.offset, table.length, bytes, 0);
	return bytes;
}

/**
 * Copies source bytes through the bounds-checked reader, so a slice that runs past the file
 * reads as zeros.
 *
 * @param reader - The source font bytes.
 * @param start - Absolute source offset.
 * @param length - Bytes to copy.
 * @param target - Destination buffer.
 * @param at - Destination offset.
 */
export function copyBytes(
	reader: Reader,
	start: number,
	length: number,
	target: Uint8Array,
	at: number,
): void {
	for (let index = 0; index < length; index++) target[at + index] = reader.u8(start + index);
}

/**
 * Writes a u16 in place when the table is long enough to hold it, so a truncated source table
 * is carried over as is.
 *
 * @param bytes - Table bytes.
 * @param offset - Field offset within the table.
 * @param value - New value.
 */
function patchU16(bytes: Uint8Array, offset: number, value: number): Uint8Array {
	if (offset + 2 <= bytes.length) new DataView(bytes.buffer).setUint16(offset, value);
	return bytes;
}

/**
 * The sum of big-endian u32 words modulo 2^32, the checksum sfnt uses for tables and the file.
 *
 * @param view - The file.
 * @param start - 4-aligned start offset.
 * @param length - A multiple of 4.
 */
function checksum(view: DataView, start: number, length: number): number {
	let sum = 0;
	for (let offset = start; offset < start + length; offset += 4) {
		sum = (sum + view.getUint32(offset)) >>> 0;
	}
	return sum;
}

/**
 * Rounds a byte count up to the next multiple of 4.
 *
 * @param length - Byte count.
 */
export function align(length: number): number {
	return (length + 3) & ~3;
}

/**
 * `value` limited to `min..max`.
 *
 * @param value - Any number.
 * @param min - Lower bound.
 * @param max - Upper bound.
 */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
