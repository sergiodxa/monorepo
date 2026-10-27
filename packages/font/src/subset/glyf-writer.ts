/**
 * Writes a TrueType subset of a variable font fixed at an instance: each glyph's varied
 * contours become a simple glyph, composites flattened, with the instance's advances. The
 * variation tables and hinting programs are left out, since the outlines no longer vary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font, FontData } from "../font.js";
import type { Point } from "../glyf.js";
import type { FontVariation } from "../variations/variation.js";

import type { HorizontalMetric, TableBytes } from "./sfnt-writer.js";

import {
	assemble,
	copyTable,
	emptyCmap,
	headTable,
	hheaTable,
	hmtxTable,
	postTable,
} from "./sfnt-writer.js";

/** `sfntVersion` of a font with TrueType outlines. */
const TRUETYPE = 0x00010000;

/** The largest `glyf` length whose offsets still fit `loca`'s halved 16-bit form. */
const SHORT_LOCA_LIMIT = 0x1fffe;

const ON_CURVE = 0x01;

/**
 * Writes the instance's glyphs `order` as a TrueType font. Every glyph is simple, so the
 * subset holds exactly `order`; `hmtx` bearings are the varied outlines' left edges.
 *
 * @param font - The instanced font.
 * @param data - Its data.
 * @param variation - The instance it was varied to.
 * @param order - The subset's glyphs as original ids.
 */
export function flattenedTrueType(
	font: Font,
	data: FontData,
	variation: FontVariation,
	order: readonly number[],
): Uint8Array {
	let glyphs = order.map((glyph) => simpleGlyph(variation.contours(glyph)));
	let offsets = [0];
	for (let glyph of glyphs) offsets.push((offsets.at(-1) ?? 0) + glyph.length);
	let glyf = new Uint8Array(offsets.at(-1) ?? 0);
	glyphs.forEach((glyph, index) => glyf.set(glyph, offsets[index] ?? 0));
	let shortLoca = glyf.length <= SHORT_LOCA_LIMIT;
	let metrics = order.map((glyph): HorizontalMetric => ({
		advance: variation.advance(glyph),
		bearing: font.glyphCBox(glyph).xMin,
	}));

	let head = headTable(data);
	if (head.length >= 52) new DataView(head.buffer).setUint16(50, shortLoca ? 0 : 1);
	let tables: TableBytes[] = [
		{ tag: "head", bytes: head },
		{ tag: "hhea", bytes: hheaTable(data, order.length, font) },
		{ tag: "maxp", bytes: maxpTable(data, order.length, glyphs) },
		{ tag: "hmtx", bytes: hmtxTable(metrics) },
		{ tag: "loca", bytes: locaTable(offsets, shortLoca) },
		{ tag: "glyf", bytes: glyf },
		{ tag: "post", bytes: postTable(data) },
		{ tag: "cmap", bytes: emptyCmap() },
	];
	for (let tag of ["name", "OS/2"]) {
		if (data.tables.has(tag)) tables.push({ tag, bytes: copyTable(data, tag) });
	}
	return assemble(tables, TRUETYPE);
}

/**
 * A simple glyph of rounded points, padded to 4 bytes: header with the points' box, end
 * points, no instructions, one flag byte per point and 16-bit coordinate deltas. A glyph
 * without contours is empty, as `loca` marks a blank glyph.
 *
 * @param contours - Contours in font units.
 */
function simpleGlyph(contours: readonly Point[][]): Uint8Array {
	let points = contours.flat();
	if (points.length === 0) return new Uint8Array();
	let xs = points.map((point) => Math.round(point.x));
	let ys = points.map((point) => Math.round(point.y));
	let size = 10 + contours.length * 2 + 2 + points.length * 5;
	let bytes = new Uint8Array((size + 3) & ~3);
	let view = new DataView(bytes.buffer);
	view.setInt16(0, contours.length);
	view.setInt16(2, Math.min(...xs));
	view.setInt16(4, Math.min(...ys));
	view.setInt16(6, Math.max(...xs));
	view.setInt16(8, Math.max(...ys));
	let at = 10;
	let end = -1;
	for (let contour of contours) {
		end += contour.length;
		view.setUint16(at, end);
		at += 2;
	}
	view.setUint16(at, 0);
	at += 2;
	for (let point of points) bytes[at++] = point.on ? ON_CURVE : 0;
	let previous = 0;
	for (let x of xs) {
		view.setInt16(at, x - previous);
		previous = x;
		at += 2;
	}
	previous = 0;
	for (let y of ys) {
		view.setInt16(at, y - previous);
		previous = y;
		at += 2;
	}
	return bytes;
}

/**
 * `maxp` with the subset's glyph count, its largest point and contour counts, and the
 * composite and hinting limits zeroed, since every glyph is simple and unhinted.
 *
 * @param data - The source font.
 * @param count - Glyphs in the subset.
 * @param glyphs - The written glyphs.
 */
function maxpTable(data: FontData, count: number, glyphs: readonly Uint8Array[]): Uint8Array {
	let maxp = copyTable(data, "maxp");
	if (maxp.length < 6) return maxp;
	let view = new DataView(maxp.buffer);
	view.setUint16(4, count);
	if (maxp.length < 32) return maxp;
	let points = 0;
	let contours = 0;
	for (let glyph of glyphs) {
		if (glyph.length === 0) continue;
		let glyphView = new DataView(glyph.buffer);
		let contourCount = glyphView.getInt16(0);
		contours = Math.max(contours, contourCount);
		points = Math.max(points, glyphView.getUint16(10 + (contourCount - 1) * 2) + 1);
	}
	view.setUint16(6, points);
	view.setUint16(8, contours);
	for (let offset = 10; offset < 32; offset += 2) {
		if (offset !== 14) view.setUint16(offset, 0);
	}
	view.setUint16(14, 1);
	return maxp;
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
