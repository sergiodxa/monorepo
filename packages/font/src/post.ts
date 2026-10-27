/**
 * Glyph names from the `post` table: the standard Macintosh order (format 1), an index into
 * it or the table's own strings (format 2), offsets into it (format 2.5) and Apple's character
 * codes (format 4). Format 3 fonts carry no names, and CFF fonts name glyphs in their charset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRecord } from "./font.js";
import type { Reader } from "./reader.js";

import { STANDARD_GLYPH_NAMES } from "./glyph-names.data.js";

/** A glyph's name by index, `null` for one the table does not name. */
export type GlyphNamer = (glyph: number) => string | null;

/** Where every `post` format's glyph data starts, after the 32-byte header. */
const HEADER_SIZE = 32;

/**
 * Builds the name lookup of a `post` table. Format 2's Pascal strings are read once here,
 * so naming each glyph afterwards is an array index.
 *
 * @param reader - The font bytes.
 * @param post - The `post` table, when the font has one.
 * @param numGlyphs - From `maxp`.
 */
export function postGlyphNamer(
	reader: Reader,
	post: TableRecord | undefined,
	numGlyphs: number,
): GlyphNamer {
	if (post === undefined || post.length < HEADER_SIZE) return () => null;
	let { offset } = post;
	let end = offset + post.length;
	let version = reader.u32(offset);
	let inRange = (glyph: number) => Number.isInteger(glyph) && glyph >= 0 && glyph < numGlyphs;

	if (version === 0x00010000) {
		return (glyph) => (inRange(glyph) ? (STANDARD_GLYPH_NAMES[glyph] ?? null) : null);
	}
	if (version === 0x00020000) return format2Namer(reader, offset, end, inRange);
	if (version === 0x00025000) {
		let count = reader.u16(offset + HEADER_SIZE);
		return (glyph) => {
			if (!inRange(glyph) || glyph >= count) return null;
			let at = offset + HEADER_SIZE + 2 + glyph;
			if (at >= end) return null;
			return STANDARD_GLYPH_NAMES[glyph + reader.i8(at)] ?? null;
		};
	}
	if (version === 0x00040000) {
		return (glyph) => {
			let at = offset + HEADER_SIZE + glyph * 2;
			if (!inRange(glyph) || at + 2 > end) return null;
			let code = reader.u16(at);
			return code === 0xffff ? null : String.fromCharCode(code);
		};
	}
	return () => null;
}

/**
 * Format 2: a name index per glyph, below 258 into the standard names and above it into
 * the Pascal strings that follow the indices. Strings that would run past the table end
 * the list.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the `post` table.
 * @param end - Absolute offset one past the table.
 * @param inRange - Whether a glyph index exists in the font.
 */
function format2Namer(
	reader: Reader,
	offset: number,
	end: number,
	inRange: (glyph: number) => boolean,
): GlyphNamer {
	let count = reader.u16(offset + HEADER_SIZE);
	let indices = offset + HEADER_SIZE + 2;
	let strings: string[] = [];
	let at = indices + count * 2;
	while (at < end) {
		let length = reader.u8(at);
		if (at + 1 + length > end) break;
		strings.push(String.fromCharCode(...reader.bytes(at + 1, length)));
		at += 1 + length;
	}
	return (glyph) => {
		if (!inRange(glyph) || glyph >= count || indices + glyph * 2 + 2 > end) return null;
		let index = reader.u16(indices + glyph * 2);
		if (index < STANDARD_GLYPH_NAMES.length) return STANDARD_GLYPH_NAMES[index] ?? null;
		return strings[index - STANDARD_GLYPH_NAMES.length] ?? null;
	};
}
