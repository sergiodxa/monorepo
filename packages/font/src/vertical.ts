/**
 * Vertical and device metrics: `vhea` and `vmtx` for vertical advances and top side bearings,
 * `VORG` for CFF vertical origins, and `hdmx` for advances rounded at specific pixel sizes.
 * Each table is checked once when first read; a table that fails the check counts as absent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font, TableRecord } from "./font.js";
import type { Reader } from "./reader.js";

/** The vertical tables of a font, located and checked. */
export interface VerticalTables {
	/** The `vhea` header's line metrics, `null` when the font has no usable `vhea`. */
	header: Font.VerticalMetrics | null;
	/** Absolute offset of `vmtx`, `null` when `vhea` and `vmtx` do not agree. */
	vmtxOffset: number | null;
	/** How many full metrics `vmtx` holds; later glyphs share the last advance. */
	numberOfMetrics: number;
	/** Absolute offset one past `vmtx`. */
	vmtxEnd: number;
	/** Absolute offset of `VORG`, `null` when the font has none. */
	vorgOffset: number | null;
	/** Absolute offset of `hdmx`, `null` when the font has no usable one. */
	hdmxOffset: number | null;
	/** Bytes per `hdmx` device record, padding included. */
	hdmxRecordSize: number;
}

/**
 * Locates and checks the vertical and device metric tables.
 *
 * @param reader - The font bytes.
 * @param tables - The table directory.
 * @param numGlyphs - From `maxp`.
 */
export function readVerticalTables(
	reader: Reader,
	tables: Map<string, TableRecord>,
	numGlyphs: number,
): VerticalTables {
	let vhea = tables.get("vhea");
	let vmtx = tables.get("vmtx");
	let header: Font.VerticalMetrics | null = null;
	let vmtxOffset: number | null = null;
	let numberOfMetrics = 0;
	if (vhea !== undefined && vhea.length >= 36) {
		header = {
			ascender: reader.i16(vhea.offset + 4),
			descender: reader.i16(vhea.offset + 6),
			lineGap: reader.i16(vhea.offset + 8),
		};
		numberOfMetrics = reader.u16(vhea.offset + 34);
		let fits = vmtx !== undefined && vmtx.length >= numberOfMetrics * 4;
		if (fits && numberOfMetrics > 0 && numberOfMetrics <= numGlyphs) {
			vmtxOffset = vmtx?.offset ?? null;
		}
	}

	let hdmx = tables.get("hdmx");
	let hdmxOffset: number | null = null;
	let hdmxRecordSize = 0;
	if (hdmx !== undefined && hdmx.length >= 8) {
		let records = reader.u16(hdmx.offset + 2);
		hdmxRecordSize = reader.u32(hdmx.offset + 4);
		if (hdmxRecordSize >= 2 + numGlyphs && 8 + records * hdmxRecordSize <= hdmx.length) {
			hdmxOffset = hdmx.offset;
		}
	}

	let vorg = tables.get("VORG");
	return {
		header,
		vmtxOffset,
		numberOfMetrics,
		vmtxEnd: vmtxOffset === null ? 0 : vmtxOffset + (vmtx?.length ?? 0),
		vorgOffset: vorg !== undefined && vorg.length >= 8 ? vorg.offset : null,
		hdmxOffset,
		hdmxRecordSize,
	};
}

/**
 * A glyph's vertical advance and top side bearing from `vmtx`. Glyphs past the full metrics
 * share the last advance and read their bearing from the trailing array, `0` past its end.
 *
 * @param reader - The font bytes.
 * @param vertical - From `readVerticalTables`.
 * @param glyph - A glyph index the font has.
 * @returns The metrics, or `null` when the font has no usable `vmtx`.
 */
export function verticalMetric(
	reader: Reader,
	vertical: VerticalTables,
	glyph: number,
): { advance: number; bearing: number } | null {
	let { vmtxOffset, numberOfMetrics } = vertical;
	if (vmtxOffset === null) return null;
	if (glyph < numberOfMetrics) {
		return {
			advance: reader.u16(vmtxOffset + glyph * 4),
			bearing: reader.i16(vmtxOffset + glyph * 4 + 2),
		};
	}
	let at = vmtxOffset + numberOfMetrics * 4 + (glyph - numberOfMetrics) * 2;
	return {
		advance: reader.u16(vmtxOffset + (numberOfMetrics - 1) * 4),
		bearing: at + 2 <= vertical.vmtxEnd ? reader.i16(at) : 0,
	};
}

/**
 * A glyph's vertical origin from `VORG`: its own entry, found by binary search, or the
 * table's default.
 *
 * @param reader - The font bytes.
 * @param vertical - From `readVerticalTables`.
 * @param glyph - A glyph index.
 * @returns The origin's y in font units, or `null` when the font has no `VORG`.
 */
export function verticalOriginOf(
	reader: Reader,
	vertical: VerticalTables,
	glyph: number,
): number | null {
	let offset = vertical.vorgOffset;
	if (offset === null) return null;
	let low = 0;
	let high = reader.u16(offset + 6) - 1;
	while (low <= high) {
		let middle = (low + high) >> 1;
		let entry = offset + 8 + middle * 4;
		let candidate = reader.u16(entry);
		if (candidate < glyph) low = middle + 1;
		else if (candidate > glyph) high = middle - 1;
		else return reader.i16(entry + 2);
	}
	return reader.i16(offset + 4);
}

/**
 * A glyph's advance rounded at one pixel size, from the `hdmx` record for that size.
 *
 * @param reader - The font bytes.
 * @param vertical - From `readVerticalTables`.
 * @param glyph - A glyph index the font has.
 * @param ppem - Pixels per em.
 * @returns The advance in whole pixels, or `null` when no record covers the size.
 */
export function deviceAdvanceOf(
	reader: Reader,
	vertical: VerticalTables,
	glyph: number,
	ppem: number,
): number | null {
	let offset = vertical.hdmxOffset;
	if (offset === null) return null;
	let records = reader.u16(offset + 2);
	for (let index = 0; index < records; index++) {
		let record = offset + 8 + index * vertical.hdmxRecordSize;
		if (reader.u8(record) === ppem) return reader.u8(record + 2 + glyph);
	}
	return null;
}
