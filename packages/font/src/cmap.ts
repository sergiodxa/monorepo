/**
 * Character-to-glyph mapping over a font's `cmap` table: every mapping format (0, 2, 4, 6, 8,
 * 10, 12 and 13), Unicode variation sequences (format 14), symbol fonts and legacy Mac
 * encodings. Lookups read the bytes on each call and binary-search where the format allows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Reader } from "./reader.js";

import { encodingOf, legacyDecode, legacyEncoder } from "./encodings.js";

/** A located mapping subtable whose arrays were checked to fit inside the `cmap` table. */
export interface CmapSubtable {
	format: 0 | 2 | 4 | 6 | 8 | 10 | 12 | 13;
	/** Absolute offset of the subtable header. */
	offset: number;
	/** Absolute offset one past the `cmap` table; glyph array reads stop here. */
	end: number;
}

/** How a font maps characters: the subtable, how to key it, and its variation sequences. */
export interface CharacterMap {
	subtable: CmapSubtable;
	/**
	 * `unicode` keys the subtable by code point; `symbol` is a Windows symbol font, keyed by
	 * code point with byte codes also found in the U+F000 block; any other value names the
	 * single-byte legacy encoding the subtable is keyed by.
	 */
	keys: string;
	/** Absolute offset of a format 14 subtable, `null` when the font has none. */
	variations: number | null;
}

/**
 * Unicode platform and encoding pairs in order of preference: full-repertoire subtables
 * first, then the BMP-only ones.
 */
const UNICODE_PREFERENCE = [
	[3, 10],
	[0, 6],
	[0, 4],
	[3, 1],
	[0, 3],
	[0, 2],
	[0, 1],
	[0, 0],
] as const;

/** The highest Unicode code point; group ranges are clamped to it when enumerated. */
const MAX_CODE_POINT = 0x10ffff;

/**
 * Chooses the subtable lookups read: the most preferred Unicode one, then a Windows symbol
 * one, then the first keyed by a single-byte legacy encoding this package can map Unicode
 * onto. Subtables whose arrays would run past the table are skipped.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the `cmap` table.
 * @param length - Length of the `cmap` table.
 * @returns The mapping, or `null` when no subtable is usable.
 */
export function selectCharacterMap(
	reader: Reader,
	offset: number,
	length: number,
): CharacterMap | null {
	let count = reader.u16(offset + 2);
	if (4 + count * 8 > length) return null;
	let end = offset + length;
	let records: { platform: number; encoding: number; subtable: number }[] = [];
	for (let index = 0; index < count; index++) {
		let record = offset + 4 + index * 8;
		let relative = reader.u32(record + 4);
		if (relative >= length) continue;
		records.push({
			platform: reader.u16(record),
			encoding: reader.u16(record + 2),
			subtable: offset + relative,
		});
	}

	let variations = records.find(
		(record) =>
			record.platform === 0 &&
			record.encoding === 5 &&
			validVariations(reader, record.subtable, end),
	);
	let found = (subtable: CmapSubtable, keys: string): CharacterMap => ({
		subtable,
		keys,
		variations: variations?.subtable ?? null,
	});

	for (let [platform, encoding] of UNICODE_PREFERENCE) {
		for (let record of records) {
			if (record.platform !== platform || record.encoding !== encoding) continue;
			let subtable = checkSubtable(reader, record.subtable, end);
			if (subtable !== null) return found(subtable, "unicode");
		}
	}
	for (let record of records) {
		if (record.platform !== 3 || record.encoding !== 0) continue;
		let subtable = checkSubtable(reader, record.subtable, end);
		if (subtable !== null) return found(subtable, "symbol");
	}
	for (let record of records) {
		let subtable = checkSubtable(reader, record.subtable, end);
		if (subtable === null) continue;
		let encoding = encodingOf(
			record.platform,
			record.encoding,
			subtableLanguage(reader, subtable) - 1,
		);
		if (encoding !== null && legacyEncoder(encoding) !== null) return found(subtable, encoding);
	}
	return null;
}

/**
 * The glyph a character maps to, `0` when it maps to nothing. A variation selector picks the
 * variant glyph a format 14 subtable lists for the pair, and the default glyph otherwise.
 *
 * @param reader - The font bytes.
 * @param map - From `selectCharacterMap`.
 * @param codePoint - A Unicode code point.
 * @param selector - A variation selector (U+FE00–FE0F, U+E0100–E01EF), when one follows.
 */
export function mapCharacter(
	reader: Reader,
	map: CharacterMap,
	codePoint: number,
	selector?: number,
): number {
	if (map.keys === "symbol") {
		let glyph = lookupCode(reader, map.subtable, codePoint);
		if (glyph === 0 && codePoint <= 0xff)
			glyph = lookupCode(reader, map.subtable, 0xf000 + codePoint);
		return glyph;
	}
	if (map.keys !== "unicode") {
		let code = codePoint < 0x80 ? codePoint : legacyEncoder(map.keys)?.get(codePoint);
		return code === undefined ? 0 : lookupCode(reader, map.subtable, code);
	}
	if (selector !== undefined && map.variations !== null) {
		let variant = variationGlyph(reader, map.variations, codePoint, selector);
		if (variant !== null) return variant;
	}
	return lookupCode(reader, map.subtable, codePoint);
}

/**
 * Every character the subtable lists, as Unicode code points in ascending order, including
 * ones that map to glyph 0; callers filter those out with `mapCharacter`.
 *
 * @param reader - The font bytes.
 * @param map - From `selectCharacterMap`.
 */
export function mappedCharacters(reader: Reader, map: CharacterMap): number[] {
	let codes = subtableCodes(reader, map.subtable);
	if (map.keys === "unicode" || map.keys === "symbol") return codes;
	let characters: number[] = [];
	for (let code of codes) {
		let character = code > 0xff ? null : legacyDecode(map.keys, code);
		if (character !== null) characters.push(character);
	}
	return [...new Set(characters)].sort((a, b) => a - b);
}

/**
 * Whether a code point is a variation selector, which picks a variant of the character
 * before it and draws nothing itself.
 *
 * @param codePoint - A Unicode code point.
 */
export function isVariationSelector(codePoint: number): boolean {
	return (
		(codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
		(codePoint >= 0xe0100 && codePoint <= 0xe01ef) ||
		(codePoint >= 0x180b && codePoint <= 0x180d) ||
		codePoint === 0x180f
	);
}

/**
 * Checks that a subtable's format is one this module reads and that the arrays its header
 * declares fit before `end`.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the subtable.
 * @param end - Absolute offset one past the `cmap` table.
 */
function checkSubtable(reader: Reader, offset: number, end: number): CmapSubtable | null {
	let format = reader.u16(offset);
	let size = 0;
	if (format === 0) size = 6 + 256;
	else if (format === 2) size = 6 + 512 + (maxSubHeaderKey(reader, offset) + 1) * 8;
	else if (format === 4) size = 16 + reader.u16(offset + 6) * 4;
	else if (format === 6) size = 10 + reader.u16(offset + 8) * 2;
	else if (format === 8) size = 8208 + reader.u32(offset + 8204) * 12;
	else if (format === 10) size = 20 + reader.u32(offset + 16) * 2;
	else if (format === 12 || format === 13) size = 16 + reader.u32(offset + 12) * 12;
	else return null;
	if (offset + size > end) return null;
	return { format, offset, end };
}

/**
 * The language field of a subtable, 16 bits in the older formats and 32 in the newer ones.
 *
 * @param reader - The font bytes.
 * @param subtable - A checked subtable.
 */
function subtableLanguage(reader: Reader, subtable: CmapSubtable): number {
	if (subtable.format >= 8) return reader.u32(subtable.offset + 8);
	return reader.u16(subtable.offset + 4);
}

/**
 * The highest sub-header index a format 2 subtable's keys reference.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the subtable.
 */
function maxSubHeaderKey(reader: Reader, offset: number): number {
	let max = 0;
	for (let byte = 0; byte < 256; byte++) {
		max = Math.max(max, reader.u16(offset + 6 + byte * 2) >> 3);
	}
	return max;
}

/**
 * Looks a code up in a subtable by its format.
 *
 * @param reader - The font bytes.
 * @param subtable - A checked subtable.
 * @param code - The character code the subtable is keyed by.
 */
function lookupCode(reader: Reader, subtable: CmapSubtable, code: number): number {
	let { offset } = subtable;
	if (!Number.isInteger(code) || code < 0) return 0;
	if (subtable.format === 0) return code < 256 ? reader.u8(offset + 6 + code) : 0;
	if (subtable.format === 2) return lookupFormat2(reader, subtable, code);
	if (subtable.format === 4) return lookupFormat4(reader, subtable, code);
	if (subtable.format === 6) {
		let index = code - reader.u16(offset + 6);
		return index >= 0 && index < reader.u16(offset + 8) ? reader.u16(offset + 10 + index * 2) : 0;
	}
	if (subtable.format === 10) {
		let index = code - reader.u32(offset + 12);
		return index >= 0 && index < reader.u32(offset + 16) ? reader.u16(offset + 20 + index * 2) : 0;
	}
	if (subtable.format === 8) return lookupGroups(reader, offset + 8204, code, false);
	return lookupGroups(reader, offset + 12, code, subtable.format === 13);
}

/**
 * High-byte mapping: a byte whose sub-header key is 0 is a one-byte code, any other byte
 * leads a two-byte code whose low byte indexes that sub-header's range.
 *
 * @param reader - The font bytes.
 * @param subtable - A checked format 2 subtable.
 * @param code - A one- or two-byte character code.
 */
function lookupFormat2(reader: Reader, subtable: CmapSubtable, code: number): number {
	if (code > 0xffff) return 0;
	let keys = subtable.offset + 6;
	let high = code >> 8;
	let key = 0;
	let byte = code & 0xff;
	if (high === 0) {
		if (reader.u16(keys + code * 2) !== 0) return 0;
	} else {
		key = reader.u16(keys + high * 2) >> 3;
		if (key === 0) return 0;
	}
	let header = keys + 512 + key * 8;
	let first = reader.u16(header);
	let count = reader.u16(header + 2);
	if (byte < first || byte >= first + count) return 0;
	let at = header + 6 + reader.u16(header + 6) + (byte - first) * 2;
	if (at + 2 > subtable.end) return 0;
	let glyph = reader.u16(at);
	return glyph === 0 ? 0 : (glyph + reader.u16(header + 4)) & 0xffff;
}

/**
 * Segment mapping: finds the first segment ending at or past the code, then maps through
 * `idDelta` or the `idRangeOffset` glyph array.
 *
 * @param reader - The font bytes.
 * @param subtable - A checked format 4 subtable.
 * @param code - A BMP code point.
 */
function lookupFormat4(reader: Reader, subtable: CmapSubtable, code: number): number {
	if (code > 0xffff) return 0;
	let { offset } = subtable;
	let segX2 = reader.u16(offset + 6);
	let segments = segX2 / 2;
	let ends = offset + 14;
	let starts = ends + segX2 + 2;
	let deltas = starts + segX2;
	let ranges = deltas + segX2;
	let low = 0;
	let high = segments - 1;
	while (low < high) {
		let middle = (low + high) >> 1;
		if (reader.u16(ends + middle * 2) < code) low = middle + 1;
		else high = middle;
	}
	if (segments === 0 || reader.u16(ends + low * 2) < code) return 0;
	let start = reader.u16(starts + low * 2);
	if (code < start) return 0;
	let delta = reader.u16(deltas + low * 2);
	let rangeAt = ranges + low * 2;
	let range = reader.u16(rangeAt);
	if (range === 0) return (code + delta) & 0xffff;
	let at = rangeAt + range + (code - start) * 2;
	if (at + 2 > subtable.end) return 0;
	let glyph = reader.u16(at);
	return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
}

/**
 * Sequential (format 8 and 12) or constant (format 13) map groups sorted by start code.
 *
 * @param reader - The font bytes.
 * @param count - Absolute offset of the 32-bit group count; the groups follow it.
 * @param code - A character code.
 * @param constant - Whether every code in a group maps to the group's one glyph.
 */
function lookupGroups(reader: Reader, count: number, code: number, constant: boolean): number {
	let low = 0;
	let high = reader.u32(count) - 1;
	while (low <= high) {
		let middle = Math.floor((low + high) / 2);
		let group = count + 4 + middle * 12;
		let start = reader.u32(group);
		if (code < start) high = middle - 1;
		else if (code > reader.u32(group + 4)) low = middle + 1;
		else return constant ? reader.u32(group + 8) : reader.u32(group + 8) + (code - start);
	}
	return 0;
}

/**
 * Every code a subtable lists, ascending. Ranges that overlap or run backwards in a
 * corrupt subtable are skipped, so the work stays bounded by the code space.
 *
 * @param reader - The font bytes.
 * @param subtable - A checked subtable.
 */
function subtableCodes(reader: Reader, subtable: CmapSubtable): number[] {
	let { offset } = subtable;
	if (subtable.format === 0) return Array.from({ length: 256 }, (_, code) => code);
	if (subtable.format === 2) return format2Codes(reader, offset);
	if (subtable.format === 6) {
		return range(reader.u16(offset + 6), reader.u16(offset + 6) + reader.u16(offset + 8) - 1);
	}
	if (subtable.format === 10) {
		let first = reader.u32(offset + 12);
		return range(first, Math.min(first + reader.u32(offset + 16) - 1, MAX_CODE_POINT));
	}
	let ranges: [number, number][] = [];
	if (subtable.format === 4) {
		let segX2 = reader.u16(offset + 6);
		for (let index = 0; index < segX2 / 2; index++) {
			let start = reader.u16(offset + 16 + segX2 + index * 2);
			ranges.push([start, reader.u16(offset + 14 + index * 2)]);
		}
	} else {
		let count = subtable.format === 8 ? offset + 8204 : offset + 12;
		for (let index = 0; index < reader.u32(count); index++) {
			let group = count + 4 + index * 12;
			ranges.push([reader.u32(group), Math.min(reader.u32(group + 4), MAX_CODE_POINT)]);
		}
	}
	let codes: number[] = [];
	let previous = -1;
	for (let [start, last] of ranges) {
		if (start <= previous || last < start) continue;
		for (let code = start; code <= last; code++) codes.push(code);
		previous = last;
	}
	return codes;
}

/**
 * The codes a format 2 subtable lists: one-byte codes from sub-header 0, two-byte codes
 * from the sub-header of each lead byte.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the subtable.
 */
function format2Codes(reader: Reader, offset: number): number[] {
	let keys = offset + 6;
	let codes: number[] = [];
	for (let high = 0; high < 256; high++) {
		let key = high === 0 ? 0 : reader.u16(keys + high * 2) >> 3;
		if (high !== 0 && key === 0) continue;
		let header = keys + 512 + key * 8;
		let first = reader.u16(header);
		let last = Math.min(first + reader.u16(header + 2), 256);
		for (let byte = first; byte < last; byte++) {
			if (high !== 0) codes.push((high << 8) | byte);
			else if (reader.u16(keys + byte * 2) === 0) codes.push(byte);
		}
	}
	return codes;
}

/**
 * Consecutive integers from `first` to `last`, both included.
 *
 * @param first - Lowest value.
 * @param last - Highest value; below `first` answers `[]`.
 */
function range(first: number, last: number): number[] {
	return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
}

/**
 * A 24-bit unsigned integer, the width format 14 stores code points in.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute byte offset.
 */
function u24(reader: Reader, offset: number): number {
	return reader.u8(offset) * 0x10000 + reader.u16(offset + 1);
}

/**
 * Checks that a format 14 subtable's selector records fit before `end`.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the subtable.
 * @param end - Absolute offset one past the `cmap` table.
 */
function validVariations(reader: Reader, offset: number, end: number): boolean {
	return reader.u16(offset) === 14 && offset + 10 + reader.u32(offset + 6) * 11 <= end;
}

/**
 * The variant glyph of a variation sequence. A sequence in the selector's default table
 * draws the character's usual glyph, as does one the subtable does not list.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the format 14 subtable.
 * @param codePoint - The base character.
 * @param selector - The variation selector.
 * @returns The variant glyph, or `null` to use the usual glyph.
 */
function variationGlyph(
	reader: Reader,
	offset: number,
	codePoint: number,
	selector: number,
): number | null {
	let low = 0;
	let high = reader.u32(offset + 6) - 1;
	let record = -1;
	while (low <= high) {
		let middle = Math.floor((low + high) / 2);
		let candidate = u24(reader, offset + 10 + middle * 11);
		if (candidate < selector) low = middle + 1;
		else if (candidate > selector) high = middle - 1;
		else {
			record = offset + 10 + middle * 11;
			break;
		}
	}
	if (record < 0) return null;

	let defaults = reader.u32(record + 3);
	if (defaults !== 0 && inDefaultRanges(reader, offset + defaults, codePoint)) return null;
	let mappings = reader.u32(record + 7);
	if (mappings === 0) return null;
	let table = offset + mappings;
	low = 0;
	high = reader.u32(table) - 1;
	while (low <= high) {
		let middle = Math.floor((low + high) / 2);
		let entry = table + 4 + middle * 5;
		let candidate = u24(reader, entry);
		if (candidate < codePoint) low = middle + 1;
		else if (candidate > codePoint) high = middle - 1;
		else return reader.u16(entry + 3);
	}
	return null;
}

/**
 * Whether a default UVS table's ranges cover a code point.
 *
 * @param reader - The font bytes.
 * @param table - Absolute offset of the default UVS table.
 * @param codePoint - The base character.
 */
function inDefaultRanges(reader: Reader, table: number, codePoint: number): boolean {
	let low = 0;
	let high = reader.u32(table) - 1;
	while (low <= high) {
		let middle = Math.floor((low + high) / 2);
		let entry = table + 4 + middle * 4;
		let start = u24(reader, entry);
		if (codePoint < start) high = middle - 1;
		else if (codePoint > start + reader.u8(entry + 3)) low = middle + 1;
		else return true;
	}
	return false;
}
