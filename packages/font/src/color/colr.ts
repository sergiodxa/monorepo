/**
 * Layered color glyphs from a `COLR` table: each base glyph paints as a stack of ordinary
 * outline glyphs, each filled with one `CPAL` color. The version 0 records are read, which
 * version 1 fonts also carry as their fallback; version 1 paint graphs are not interpreted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "../font.js";

import { Reader } from "../reader.js";

import type { Color } from "./cpal.js";

import { paletteForLayers } from "./cpal.js";

/** One layer of a color glyph, painted bottom to top in the order returned. */
export interface ColorLayer {
	/** The outline glyph to fill; draw it with `font.outline(glyph)` or `font.path(...)`. */
	glyph: number;
	/** The fill, or `"foreground"` when the layer takes the caller's text color. */
	color: Color | "foreground";
}

/** Options for `colorLayers`. */
export interface ColorLayersOptions {
	/**
	 * Index into `palettes(font)`; an index the font lacks paints with palette 0.
	 * @default 0
	 */
	palette?: number;
}

/** The palette index a `COLR` layer uses for the text foreground color. */
const FOREGROUND = 0xffff;

/** Bytes in a version 0 `COLR` header. */
const HEADER_SIZE = 14;

/**
 * Binary-searches the base glyph records, which the format keeps sorted by glyph ID, for
 * `glyph`'s record offset, or `-1` when it has none.
 *
 * @param reader - The `COLR` table.
 * @param glyph - Glyph index.
 */
function findBaseGlyph(reader: Reader, glyph: number): number {
	let count = reader.u16(2);
	let offset = reader.u32(4);
	if (offset + count * 6 > reader.length) return -1;
	let low = 0;
	let high = count - 1;
	while (low <= high) {
		let middle = (low + high) >> 1;
		let id = reader.u16(offset + middle * 6);
		if (id === glyph) return offset + middle * 6;
		if (id < glyph) low = middle + 1;
		else high = middle - 1;
	}
	return -1;
}

/**
 * A glyph's color layers, each an outline glyph with its fill from the chosen `CPAL`
 * palette; a layer index past the palette's end paints with the foreground color.
 *
 * @param font - The font to read.
 * @param glyph - Glyph index, from `font.glyphIndex`.
 * @param options - The palette to paint with.
 * @returns The layers bottom to top, or `null` when the glyph has no color layers, the
 * font has no `COLR`/`CPAL` tables, or its records run past the table.
 * @example colorLayers(font, font.glyphIndex(0x1f61c))?.map((layer) => layer.glyph)
 */
export function colorLayers(
	font: Font,
	glyph: number,
	options: ColorLayersOptions = {},
): ColorLayer[] | null {
	let bytes = font.table("COLR");
	if (bytes === null || bytes.byteLength < HEADER_SIZE) return null;
	let reader = new Reader(bytes);
	let record = findBaseGlyph(reader, glyph);
	if (record < 0) return null;
	let first = reader.u16(record + 2);
	let count = reader.u16(record + 4);
	let layersOffset = reader.u32(8);
	if (first + count > reader.u16(12)) return null;
	if (layersOffset + (first + count) * 4 > reader.length) return null;
	let palette = paletteForLayers(font, options.palette ?? 0);
	if (palette === null) return null;
	let layers: ColorLayer[] = [];
	for (let index = first; index < first + count; index++) {
		let at = layersOffset + index * 4;
		let entry = reader.u16(at + 2);
		let color = entry === FOREGROUND ? undefined : palette[entry];
		layers.push({ glyph: reader.u16(at), color: color ?? "foreground" });
	}
	return layers;
}
