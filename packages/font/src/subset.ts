/**
 * Writes a TrueType font holding only the glyphs a document draws. Glyphs keep their outlines,
 * metrics and hinting; every table that maps characters, shapes or positions text is dropped,
 * because an embedding document addresses glyphs by id and has already placed them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { FontError } from "./font-error.js";
import type { Font, FontData } from "./font.js";
import type { Reader } from "./reader.js";
import type { TableBytes } from "./subset/sfnt-writer.js";

import { glyphRange } from "./glyf.js";
import {
	align,
	assemble,
	copyBytes,
	copyTable,
	emptyCmap,
	postTable,
} from "./subset/sfnt-writer.js";

const ARGS_ARE_WORDS = 0x0001;
const HAS_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const HAS_XY_SCALE = 0x0040;
const HAS_TWO_BY_TWO = 0x0080;

/** The largest `glyf` length whose offsets still fit `loca`'s halved 16-bit form. */
const SHORT_LOCA_LIMIT = 0x1fffe;

/** Tables copied byte for byte when the source has them; the hinting programs index `cvt `. */
const COPIED_TABLES = ["name", "OS/2", "cvt ", "fpgm", "prep"] as const;

/**
 * Writes a TrueType font holding only `glyphs` (plus `.notdef` and composite components).
 * Glyph 0 stays 0, the requested ids follow in order without repeats or ids the font lacks,
 * then components of composites; composites are rewritten to point at the new ids.
 *
 * @param data - The source font's located tables.
 * @param glyphs - Original glyph ids, in the order the subset numbers them.
 * @returns A complete `.ttf` with a `cmap` that maps no characters, and the id mapping.
 */
export function subsetFont(
	data: FontData,
	glyphs: Iterable<number>,
): Result<Font.Subset, FontError> {
	let order = glyphOrder(data, glyphs);
	let ids = new Map(order.map((original, index) => [original, index]));

	let glyf = buildGlyf(data, order, ids);
	let shortLoca = glyf.bytes.length <= SHORT_LOCA_LIMIT;

	let tables: TableBytes[] = [
		{ tag: "head", bytes: headTable(data, shortLoca) },
		{ tag: "hhea", bytes: patchU16(copyTable(data, "hhea"), 34, order.length) },
		{ tag: "maxp", bytes: patchU16(copyTable(data, "maxp"), 4, order.length) },
		{ tag: "hmtx", bytes: hmtxTable(data, order) },
		{ tag: "loca", bytes: locaTable(glyf.offsets, shortLoca) },
		{ tag: "glyf", bytes: glyf.bytes },
		{ tag: "post", bytes: postTable(data) },
		{ tag: "cmap", bytes: emptyCmap() },
	];
	for (let tag of COPIED_TABLES) {
		if (data.tables.has(tag)) tables.push({ tag, bytes: copyTable(data, tag) });
	}

	return success({
		bytes: assemble(tables, 0x00010000),
		glyphs: order,
		glyphId: (original: number) => ids.get(original) ?? 0,
	});
}

/**
 * The subset's glyphs as original ids, indexed by new id. Components are appended while the
 * list is walked, so nested composites resolve and a cycle ends because an id joins once.
 *
 * @param data - The source font.
 * @param requested - Original ids in the caller's order.
 */
function glyphOrder(data: FontData, requested: Iterable<number>): number[] {
	let order = [0];
	let seen = new Set(order);
	let add = (glyph: number) => {
		if (!Number.isInteger(glyph) || glyph < 0 || glyph >= data.numGlyphs || seen.has(glyph)) return;
		seen.add(glyph);
		order.push(glyph);
	};
	for (let glyph of requested) add(glyph);
	for (let index = 0; index < order.length; index++) {
		let range = glyphRange(data, order[index] ?? 0);
		if (range === null || data.reader.i16(range.start) >= 0) continue;
		for (let component of componentOffsets(data.reader, range.start, range.end)) {
			add(data.reader.u16(component));
		}
	}
	return order;
}

/**
 * Offsets of every component's `glyphIndex` field in a composite glyph, stopping at the first
 * record that would run past the glyph so a truncated composite keeps its complete records.
 *
 * @param reader - Bytes holding the glyph.
 * @param start - Offset of the glyph header.
 * @param end - Offset one past the glyph's data.
 */
function componentOffsets(reader: Reader, start: number, end: number): number[] {
	let offsets: number[] = [];
	let offset = start + 10;
	let flags = MORE_COMPONENTS;
	while (flags & MORE_COMPONENTS) {
		if (offset + 4 > end) break;
		flags = reader.u16(offset);
		offsets.push(offset + 2);
		offset += 4 + (flags & ARGS_ARE_WORDS ? 4 : 2);
		if (flags & HAS_SCALE) offset += 2;
		else if (flags & HAS_XY_SCALE) offset += 4;
		else if (flags & HAS_TWO_BY_TWO) offset += 8;
	}
	return offsets;
}

/**
 * The subset's `glyf` with each glyph padded to 4 bytes, which keeps every offset even for the
 * short `loca` form, and the `numGlyphs + 1` offsets `loca` stores.
 *
 * @param data - The source font.
 * @param order - Original id of each subset glyph.
 * @param ids - New id of each original id in the subset.
 */
function buildGlyf(
	data: FontData,
	order: readonly number[],
	ids: ReadonlyMap<number, number>,
): { bytes: Uint8Array; offsets: number[] } {
	let ranges = order.map((glyph) => glyphRange(data, glyph));
	let offsets = [0];
	for (let range of ranges) {
		let size = range === null ? 0 : align(range.end - range.start);
		offsets.push((offsets[offsets.length - 1] ?? 0) + size);
	}
	let bytes = new Uint8Array(offsets[offsets.length - 1] ?? 0);
	let view = new DataView(bytes.buffer);
	ranges.forEach((range, index) => {
		if (range === null) return;
		let target = offsets[index] ?? 0;
		copyBytes(data.reader, range.start, range.end - range.start, bytes, target);
		if (data.reader.i16(range.start) >= 0) return;
		for (let component of componentOffsets(data.reader, range.start, range.end)) {
			let field = target + component - range.start;
			view.setUint16(field, ids.get(data.reader.u16(component)) ?? 0);
		}
	});
	return { bytes, offsets };
}

/**
 * `head` with `indexToLocFormat` matching the written `loca` and `checkSumAdjustment` zeroed,
 * the value its own checksum is computed with before `assemble` fills it in.
 *
 * @param data - The source font.
 * @param shortLoca - Whether `loca` uses the halved 16-bit form.
 */
function headTable(data: FontData, shortLoca: boolean): Uint8Array {
	let head = copyTable(data, "head");
	new DataView(head.buffer).setUint32(8, 0);
	return patchU16(head, 50, shortLoca ? 0 : 1);
}

/**
 * One full metric per subset glyph, so `hhea.numberOfHMetrics` equals the glyph count. A
 * source glyph past `numberOfHMetrics` takes the last advance and its own trailing bearing,
 * `0` when the source `hmtx` is too short to hold it.
 *
 * @param data - The source font.
 * @param order - Original id of each subset glyph.
 */
function hmtxTable(data: FontData, order: readonly number[]): Uint8Array {
	let { reader, hmtxOffset, numberOfHMetrics } = data;
	let hmtxEnd = hmtxOffset + (data.tables.get("hmtx")?.length ?? 0);
	let bytes = new Uint8Array(order.length * 4);
	let view = new DataView(bytes.buffer);
	order.forEach((glyph, index) => {
		let advance = reader.u16(hmtxOffset + Math.min(glyph, numberOfHMetrics - 1) * 4);
		let bearingOffset =
			glyph < numberOfHMetrics
				? hmtxOffset + glyph * 4 + 2
				: hmtxOffset + numberOfHMetrics * 4 + (glyph - numberOfHMetrics) * 2;
		let bearing = bearingOffset + 2 <= hmtxEnd ? reader.i16(bearingOffset) : 0;
		view.setUint16(index * 4, advance);
		view.setInt16(index * 4 + 2, bearing);
	});
	return bytes;
}

/**
 * `loca` in the short form (offsets halved) or the long form.
 *
 * @param offsets - Byte offsets into `glyf`, one past the last glyph included.
 * @param shortLoca - Whether to write 16-bit halved offsets.
 */
function locaTable(offsets: readonly number[], shortLoca: boolean): Uint8Array {
	let size = shortLoca ? 2 : 4;
	let bytes = new Uint8Array(offsets.length * size);
	let view = new DataView(bytes.buffer);
	offsets.forEach((offset, index) => {
		if (shortLoca) view.setUint16(index * 2, offset / 2);
		else view.setUint32(index * 4, offset);
	});
	return bytes;
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
