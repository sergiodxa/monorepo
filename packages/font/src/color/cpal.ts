/**
 * The `CPAL` color palettes a layered `COLR` glyph paints from. Versions 0 and 1 are read;
 * version 1 adds each palette's light/dark background hint and the `name` IDs that label
 * palettes and entries for a palette picker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "../font.js";

import { Reader } from "../reader.js";

/** An sRGB color with straight (unpremultiplied) alpha, each channel 0–255. */
export interface Color {
	red: number;
	green: number;
	blue: number;
	alpha: number;
}

/** One `CPAL` palette, the colors a `COLR` layer's palette index selects from. */
export interface Palette {
	/** The palette's entries in index order; every palette has the same count. */
	colors: Color[];
	/** The font marks this palette as legible on a light background (version 1 only). */
	lightBackground: boolean;
	/** The font marks this palette as legible on a dark background (version 1 only). */
	darkBackground: boolean;
	/** The `name` table ID labelling the palette, `null` when it has none. */
	labelNameId: number | null;
}

/** A `name` ID field's "no name" value. */
const NO_NAME = 0xffff;

/** Bytes before `colorRecordIndices` in every `CPAL` version. */
const HEADER_SIZE = 12;

/**
 * A `CPAL` table's header, with the color records' location checked to lie inside the
 * table so every color read afterwards stays in bounds.
 */
interface CpalHeader {
	reader: Reader;
	version: number;
	entries: number;
	palettes: number;
	records: number;
	recordsOffset: number;
}

/**
 * Reads the `CPAL` header, or `null` when the font has none or its color records run past
 * the table's end.
 *
 * @param font - The font to read.
 */
function cpalHeader(font: Font): CpalHeader | null {
	let bytes = font.table("CPAL");
	if (bytes === null || bytes.byteLength < HEADER_SIZE) return null;
	let reader = new Reader(bytes);
	let header: CpalHeader = {
		reader,
		version: reader.u16(0),
		entries: reader.u16(2),
		palettes: reader.u16(4),
		records: reader.u16(6),
		recordsOffset: reader.u32(8),
	};
	if (header.recordsOffset + header.records * 4 > reader.length) return null;
	if (HEADER_SIZE + header.palettes * 2 > reader.length) return null;
	return header;
}

/**
 * One palette's colors; an entry whose record falls outside the record array reads as
 * opaque black, so a palette always has `entries` colors.
 *
 * @param header - The table's header.
 * @param index - Palette index, already known to be in range.
 */
function paletteColors(header: CpalHeader, index: number): Color[] {
	let { reader, entries, records, recordsOffset } = header;
	let first = reader.u16(HEADER_SIZE + index * 2);
	let colors: Color[] = [];
	for (let entry = 0; entry < entries; entry++) {
		let record = first + entry;
		if (record >= records) {
			colors.push({ red: 0, green: 0, blue: 0, alpha: 255 });
			continue;
		}
		let at = recordsOffset + record * 4;
		colors.push({
			red: reader.u8(at + 2),
			green: reader.u8(at + 1),
			blue: reader.u8(at),
			alpha: reader.u8(at + 3),
		});
	}
	return colors;
}

/**
 * The absolute offset of a version 1 array, or `0` when the font omits it or the array of
 * `count` items of `size` bytes runs past the table.
 *
 * @param header - The table's header.
 * @param field - Offset of the array's offset field.
 * @param count - Items in the array.
 * @param size - Bytes per item.
 */
function versionOneArray(header: CpalHeader, field: number, count: number, size: number): number {
	if (header.version < 1) return 0;
	let offset = header.reader.u32(field);
	if (offset === 0 || offset + count * size > header.reader.length) return 0;
	return offset;
}

/**
 * Every palette in the font's `CPAL` table, palette 0 being the default `colorLayers`
 * paints with.
 *
 * @param font - The font to read.
 * @returns The palettes, or `[]` when the font has no `CPAL` table or it is malformed.
 * @example palettes(font).findIndex((palette) => palette.darkBackground)
 */
export function palettes(font: Font): Palette[] {
	let header = cpalHeader(font);
	if (header === null) return [];
	let field = HEADER_SIZE + header.palettes * 2;
	let types = versionOneArray(header, field, header.palettes, 4);
	let labels = versionOneArray(header, field + 4, header.palettes, 2);
	let result: Palette[] = [];
	for (let index = 0; index < header.palettes; index++) {
		let type = types === 0 ? 0 : header.reader.u32(types + index * 4);
		let label = labels === 0 ? NO_NAME : header.reader.u16(labels + index * 2);
		result.push({
			colors: paletteColors(header, index),
			lightBackground: (type & 1) !== 0,
			darkBackground: (type & 2) !== 0,
			labelNameId: label === NO_NAME ? null : label,
		});
	}
	return result;
}

/**
 * The `name` table IDs labelling each palette entry (version 1), shared by every palette,
 * so a picker can name "skin" or "outline" whatever palette is active.
 *
 * @param font - The font to read.
 * @returns One ID or `null` per entry; `[]` when the font labels no entries.
 */
export function paletteEntryLabels(font: Font): (number | null)[] {
	let header = cpalHeader(font);
	if (header === null) return [];
	let field = HEADER_SIZE + header.palettes * 2 + 8;
	let offset = versionOneArray(header, field, header.entries, 2);
	if (offset === 0) return [];
	let labels: (number | null)[] = [];
	for (let entry = 0; entry < header.entries; entry++) {
		let label = header.reader.u16(offset + entry * 2);
		labels.push(label === NO_NAME ? null : label);
	}
	return labels;
}

/**
 * One palette's colors for `colorLayers`, falling back to palette 0 when `index` is out of
 * range, or `null` when the font has no usable `CPAL`.
 *
 * @param font - The font to read.
 * @param index - The requested palette.
 */
export function paletteForLayers(font: Font, index: number): Color[] | null {
	let header = cpalHeader(font);
	if (header === null || header.palettes === 0) return null;
	let chosen = Number.isInteger(index) && index >= 0 && index < header.palettes ? index : 0;
	return paletteColors(header, chosen);
}
