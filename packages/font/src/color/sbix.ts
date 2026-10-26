/**
 * Bitmap glyphs from Apple's `sbix` table: each strike holds one image per glyph at one
 * pixels-per-em size. Images come back as the font stores them, PNG or JPEG bytes most
 * often, for `@sdxc/png` or a browser to decode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "../font.js";

import { fontData } from "../font.js";
import { Reader } from "../reader.js";

/** One `sbix` strike: the images drawn for one pixels-per-em size. */
export interface Strike {
	/** The em size, in pixels, the images were drawn for. */
	ppem: number;
	/** The pixel density the images were drawn at, 72 for one pixel per point. */
	ppi: number;
}

/**
 * An image's format, the `sbix` graphic type with its padding trimmed; other tags the font
 * declares come through as they are.
 */
export type BitmapType = "png" | "jpg" | "tiff" | "pdf" | "mask" | (string & {});

/** A glyph's bitmap from one strike, the bytes still encoded. */
export interface Bitmap {
	type: BitmapType;
	/** The strike's em size; scale the image by `size / ppem` to draw at `size`. */
	ppem: number;
	/** Horizontal offset, in pixels at `ppem`, from the glyph origin to the image's left edge. */
	originX: number;
	/** Vertical offset, in pixels at `ppem`, from the glyph origin to the image's bottom edge. */
	originY: number;
	/** The encoded image, a view sharing the font's buffer that must not be written to. */
	bytes: Uint8Array;
}

/** How many `dupe` references are followed before a glyph reads as having no image. */
const MAX_DUPES = 8;

/** Bytes before a glyph's image data: two origin offsets and the graphic type tag. */
const GLYPH_HEADER = 8;

/** The `sbix` table with each strike's absolute offset, kept only when it lies in bounds. */
interface SbixTable {
	reader: Reader;
	strikes: { offset: number; strike: Strike }[];
	numGlyphs: number;
}

/**
 * Reads the strike list, dropping any strike whose glyph offset array runs past the table.
 *
 * @param font - The font to read.
 */
function sbixTable(font: Font): SbixTable | null {
	let bytes = font.table("sbix");
	if (bytes === null || bytes.byteLength < 8) return null;
	let reader = new Reader(bytes);
	let numGlyphs = fontData(font).numGlyphs;
	let count = reader.u32(4);
	if (8 + count * 4 > reader.length) return null;
	let strikes: SbixTable["strikes"] = [];
	for (let index = 0; index < count; index++) {
		let offset = reader.u32(8 + index * 4);
		if (offset + 4 + (numGlyphs + 1) * 4 > reader.length) continue;
		strikes.push({ offset, strike: { ppem: reader.u16(offset), ppi: reader.u16(offset + 2) } });
	}
	return { reader, strikes, numGlyphs };
}

/**
 * The font's bitmap strikes in table order.
 *
 * @param font - The font to read.
 * @returns The strikes, or `[]` when the font has no `sbix` table.
 * @example strikes(font).map((strike) => strike.ppem)
 */
export function strikes(font: Font): Strike[] {
	return sbixTable(font)?.strikes.map((entry) => entry.strike) ?? [];
}

/**
 * The strike drawn for `ppem`: the smallest at least that size, so an image is only ever
 * scaled down, else the largest the font has.
 *
 * @param table - The parsed table.
 * @param ppem - The requested size in pixels per em.
 * @returns The strike, or `null` when the table has none.
 */
function pickStrike(table: SbixTable, ppem: number): SbixTable["strikes"][number] | null {
	let best: SbixTable["strikes"][number] | null = null;
	let largest: SbixTable["strikes"][number] | null = null;
	for (let entry of table.strikes) {
		if (largest === null || entry.strike.ppem > largest.strike.ppem) largest = entry;
		if (entry.strike.ppem < ppem) continue;
		if (best === null || entry.strike.ppem < best.strike.ppem) best = entry;
	}
	return best ?? largest;
}

/**
 * A glyph's image in one strike, following `dupe` records to the glyph they copy.
 *
 * @param table - The parsed table.
 * @param strike - The chosen strike.
 * @param glyph - Glyph index.
 */
function strikeImage(
	table: SbixTable,
	strike: SbixTable["strikes"][number],
	glyph: number,
): Bitmap | null {
	let { reader } = table;
	let current = glyph;
	for (let hop = 0; hop <= MAX_DUPES; hop++) {
		if (!Number.isInteger(current) || current < 0 || current >= table.numGlyphs) return null;
		let offsets = strike.offset + 4 + current * 4;
		let start = strike.offset + reader.u32(offsets);
		let end = strike.offset + reader.u32(offsets + 4);
		if (end - start < GLYPH_HEADER || end > reader.length) return null;
		let tag = reader.tag(start + 4);
		if (tag === "dupe") {
			current = reader.u16(start + GLYPH_HEADER);
			continue;
		}
		return {
			type: tag.trimEnd(),
			ppem: strike.strike.ppem,
			originX: reader.i16(start),
			originY: reader.i16(start + 2),
			bytes: reader.bytes(start + GLYPH_HEADER, end - start - GLYPH_HEADER),
		};
	}
	return null;
}

/**
 * A glyph's bitmap for drawing at `ppem` pixels per em, from the smallest strike at least
 * that size, else the largest strike.
 *
 * @param font - The font to read.
 * @param glyph - Glyph index, from `font.glyphIndex`.
 * @param ppem - The size it will be drawn at, in pixels per em.
 * @returns The image, or `null` when the font has no `sbix` table or that strike has no
 * image for the glyph.
 * @example bitmap(font, font.glyphIndex(0x1f61c), 64)?.type // "png"
 */
export function bitmap(font: Font, glyph: number, ppem: number): Bitmap | null {
	let table = sbixTable(font);
	if (table === null) return null;
	let strike = pickStrike(table, ppem);
	if (strike === null) return null;
	return strikeImage(table, strike, glyph);
}
