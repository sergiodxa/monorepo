/**
 * The structures GSUB and GPOS share, read straight from the font's bytes: the script,
 * feature and lookup lists, coverage and class definition tables, and feature variations.
 * Every offset is checked against the table, so a hostile font reads as empty lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRecord } from "../font.js";
import type { Reader } from "../reader.js";

/** A located GSUB or GPOS table with the absolute offsets of its lists, `0` for a list it lacks. */
export interface LayoutTable {
	tag: "GSUB" | "GPOS";
	reader: Reader;
	/** Absolute offset of the table header. */
	offset: number;
	/** One past the table's last byte; reads beyond it belong to another table. */
	end: number;
	scriptList: number;
	featureList: number;
	lookupList: number;
	featureVariations: number;
	/** Lookups decoded so far, by lookup list index. */
	lookups: Map<number, Lookup | null>;
}

/** A lookup subtable at an absolute offset, with extension subtables already unwrapped. */
export interface Subtable {
	type: number;
	offset: number;
}

/** One lookup: its type, flags and subtables, in the order the font tries them. */
export interface Lookup {
	index: number;
	/** The lookup type after unwrapping extensions: GSUB 1–8, GPOS 1–9 (7 and 9 never remain). */
	type: number;
	/** The `LookupFlag` word: bit flags in the low byte, mark attachment type in the high byte. */
	flags: number;
	/** Index into GDEF's mark glyph sets, `-1` when the lookup does not filter marks. */
	markFilteringSet: number;
	subtables: Subtable[];
}

/** A feature's lookups and its parameters' absolute offset, `0` when it has none. */
export interface Feature {
	tag: string;
	lookupIndices: number[];
	params: number;
	/** Absolute offset of the feature table itself, which parameters are relative to. */
	offset: number;
}

/** A language system: the features it enables, by feature list index. */
export interface LanguageSystem {
	/** The language tag found, `null` for the script's default language system. */
	tag: string | null;
	required: number;
	featureIndices: number[];
}

/** The `LookupFlag` bits a glyph iterator and cursive attachment read. */
export const LOOKUP_FLAG = {
	RIGHT_TO_LEFT: 0x0001,
	IGNORE_BASE_GLYPHS: 0x0002,
	IGNORE_LIGATURES: 0x0004,
	IGNORE_MARKS: 0x0008,
	USE_MARK_FILTERING_SET: 0x0010,
};

/** The extension lookup type in each table; its subtables point at a subtable of another type. */
const EXTENSION_TYPE = { GSUB: 7, GPOS: 9 };

/**
 * Locates a GSUB or GPOS table's lists, accepting versions 1.0 and 1.1 (feature variations).
 *
 * @param reader - The font bytes.
 * @param tag - Which table.
 * @param record - Its directory entry.
 * @returns The table, or `null` when its header is not one this reader knows.
 */
export function readLayoutTable(
	reader: Reader,
	tag: "GSUB" | "GPOS",
	record: TableRecord,
): LayoutTable | null {
	let { offset, length } = record;
	if (length < 10 || reader.u16(offset) !== 1) return null;
	let end = offset + length;
	let at = (relative: number) => (relative > 0 && relative < length ? offset + relative : 0);
	let minor = reader.u16(offset + 2);
	let variations = minor >= 1 && length >= 14 ? at(reader.u32(offset + 10)) : 0;
	return {
		tag,
		reader,
		offset,
		end,
		scriptList: at(reader.u16(offset + 4)),
		featureList: at(reader.u16(offset + 6)),
		lookupList: at(reader.u16(offset + 8)),
		featureVariations: variations,
		lookups: new Map(),
	};
}

/**
 * Every script tag the table lists, in the font's order.
 *
 * @param table - A GSUB or GPOS table.
 */
export function scriptTags(table: LayoutTable): string[] {
	let { reader, scriptList } = table;
	if (scriptList === 0) return [];
	let tags: string[] = [];
	let count = reader.u16(scriptList);
	for (let index = 0; index < count; index++) tags.push(reader.tag(scriptList + 2 + index * 6));
	return tags;
}

/**
 * The absolute offset of a script table by tag, `0` when the table does not list it.
 *
 * @param table - A GSUB or GPOS table.
 * @param tag - An OpenType script tag.
 */
export function scriptOffset(table: LayoutTable, tag: string): number {
	let { reader, scriptList } = table;
	if (scriptList === 0) return 0;
	let count = reader.u16(scriptList);
	for (let index = 0; index < count; index++) {
		let record = scriptList + 2 + index * 6;
		if (reader.tag(record) !== tag) continue;
		let relative = reader.u16(record + 4);
		return relative === 0 ? 0 : scriptList + relative;
	}
	return 0;
}

/**
 * Every language tag a script lists, in the font's order.
 *
 * @param table - A GSUB or GPOS table.
 * @param script - Absolute offset of the script table.
 */
export function languageTags(table: LayoutTable, script: number): string[] {
	let { reader } = table;
	let tags: string[] = [];
	let count = reader.u16(script + 2);
	for (let index = 0; index < count; index++) tags.push(reader.tag(script + 4 + index * 6));
	return tags;
}

/**
 * The language system for a language tag, falling back to the script's default one.
 *
 * @param table - A GSUB or GPOS table.
 * @param script - Absolute offset of the script table.
 * @param language - A four-character language tag, or `null` for the default.
 * @returns The language system, or `null` when the script has neither.
 */
export function languageSystem(
	table: LayoutTable,
	script: number,
	language: string | null,
): LanguageSystem | null {
	let { reader } = table;
	let count = reader.u16(script + 2);
	if (language !== null) {
		for (let index = 0; index < count; index++) {
			let record = script + 4 + index * 6;
			if (reader.tag(record) !== language) continue;
			let relative = reader.u16(record + 4);
			if (relative !== 0) return readLanguageSystem(reader, script + relative, language);
		}
	}
	let fallback = reader.u16(script);
	if (fallback === 0) return null;
	return readLanguageSystem(reader, script + fallback, null);
}

/**
 * A `LangSys` table's required feature and feature indices.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the table.
 * @param tag - The language it was found under.
 */
function readLanguageSystem(reader: Reader, offset: number, tag: string | null): LanguageSystem {
	let count = reader.u16(offset + 4);
	let featureIndices: number[] = [];
	for (let index = 0; index < count; index++)
		featureIndices.push(reader.u16(offset + 6 + index * 2));
	return { tag, required: reader.u16(offset + 2), featureIndices };
}

/**
 * How many features the feature list holds.
 *
 * @param table - A GSUB or GPOS table.
 */
export function featureCount(table: LayoutTable): number {
	return table.featureList === 0 ? 0 : table.reader.u16(table.featureList);
}

/**
 * A feature by feature list index, `null` past the end of the list.
 *
 * @param table - A GSUB or GPOS table.
 * @param index - Feature list index.
 * @param substitute - Absolute offset of a feature table that replaces this one under the
 *   current variation, `0` for none.
 */
export function feature(table: LayoutTable, index: number, substitute = 0): Feature | null {
	let { reader, featureList } = table;
	if (featureList === 0 || index >= reader.u16(featureList)) return null;
	let record = featureList + 2 + index * 6;
	let tag = reader.tag(record);
	let offset = substitute === 0 ? featureList + reader.u16(record + 4) : substitute;
	let params = reader.u16(offset);
	let count = reader.u16(offset + 2);
	let lookupIndices: number[] = [];
	for (let item = 0; item < count; item++) lookupIndices.push(reader.u16(offset + 4 + item * 2));
	return { tag, lookupIndices, params: params === 0 ? 0 : offset + params, offset };
}

/**
 * A lookup by lookup list index, decoded once and cached on the table.
 *
 * @param table - A GSUB or GPOS table.
 * @param index - Lookup list index.
 * @returns The lookup, or `null` for an index past the list.
 */
export function lookup(table: LayoutTable, index: number): Lookup | null {
	let cached = table.lookups.get(index);
	if (cached !== undefined) return cached;
	let decoded = readLookup(table, index);
	table.lookups.set(index, decoded);
	return decoded;
}

/**
 * Decodes a lookup, unwrapping extension subtables to the subtable they point at.
 *
 * @param table - A GSUB or GPOS table.
 * @param index - Lookup list index.
 */
function readLookup(table: LayoutTable, index: number): Lookup | null {
	let { reader, lookupList } = table;
	if (lookupList === 0 || index >= reader.u16(lookupList)) return null;
	let offset = lookupList + reader.u16(lookupList + 2 + index * 2);
	let type = reader.u16(offset);
	let flags = reader.u16(offset + 2);
	let count = reader.u16(offset + 4);
	let markFilteringSet = -1;
	if ((flags & LOOKUP_FLAG.USE_MARK_FILTERING_SET) !== 0) {
		markFilteringSet = reader.u16(offset + 6 + count * 2);
	}
	let extension = EXTENSION_TYPE[table.tag];
	let subtables: Subtable[] = [];
	let resolved = type;
	for (let item = 0; item < count; item++) {
		let subtable = offset + reader.u16(offset + 6 + item * 2);
		if (type !== extension) {
			subtables.push({ type, offset: subtable });
			continue;
		}
		let inner = reader.u16(subtable + 2);
		if (reader.u16(subtable) !== 1 || inner === extension) continue;
		resolved = inner;
		subtables.push({ type: inner, offset: subtable + reader.u32(subtable + 4) });
	}
	return { index, type: resolved, flags, markFilteringSet, subtables };
}

/**
 * A glyph's index in a coverage table, `-1` when the table does not cover it.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the coverage table.
 * @param glyph - Glyph index.
 */
export function coverageIndex(reader: Reader, offset: number, glyph: number): number {
	let format = reader.u16(offset);
	let count = reader.u16(offset + 2);
	let low = 0;
	let high = count - 1;
	if (format === 1) {
		while (low <= high) {
			let middle = (low + high) >> 1;
			let value = reader.u16(offset + 4 + middle * 2);
			if (value === glyph) return middle;
			if (value < glyph) low = middle + 1;
			else high = middle - 1;
		}
		return -1;
	}
	if (format !== 2) return -1;
	while (low <= high) {
		let middle = (low + high) >> 1;
		let range = offset + 4 + middle * 6;
		if (glyph < reader.u16(range)) high = middle - 1;
		else if (glyph > reader.u16(range + 2)) low = middle + 1;
		else return reader.u16(range + 4) + glyph - reader.u16(range);
	}
	return -1;
}

/**
 * Every glyph a coverage table lists, in coverage order.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the coverage table.
 */
export function coverageGlyphs(reader: Reader, offset: number): number[] {
	let format = reader.u16(offset);
	let count = reader.u16(offset + 2);
	let glyphs: number[] = [];
	for (let index = 0; index < count; index++) {
		if (format === 1) glyphs.push(reader.u16(offset + 4 + index * 2));
		else if (format === 2) {
			let range = offset + 4 + index * 6;
			for (let glyph = reader.u16(range); glyph <= reader.u16(range + 2); glyph++)
				glyphs.push(glyph);
		}
	}
	return glyphs;
}

/**
 * A glyph's class in a class definition table, `0` for a glyph it does not list.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the class definition table, `0` for none.
 * @param glyph - Glyph index.
 */
export function glyphClass(reader: Reader, offset: number, glyph: number): number {
	if (offset === 0) return 0;
	let format = reader.u16(offset);
	if (format === 1) {
		let start = reader.u16(offset + 2);
		let count = reader.u16(offset + 4);
		let index = glyph - start;
		return index >= 0 && index < count ? reader.u16(offset + 6 + index * 2) : 0;
	}
	if (format !== 2) return 0;
	let low = 0;
	let high = reader.u16(offset + 2) - 1;
	while (low <= high) {
		let middle = (low + high) >> 1;
		let range = offset + 4 + middle * 6;
		if (glyph < reader.u16(range)) high = middle - 1;
		else if (glyph > reader.u16(range + 2)) low = middle + 1;
		else return reader.u16(range + 4);
	}
	return 0;
}

/**
 * The feature table substitutions of the first feature variation record whose conditions
 * hold at the given coordinates, by feature index.
 *
 * @param table - A GSUB or GPOS table.
 * @param coordinates - Normalized axis coordinates; a missing axis reads as the default, `0`.
 * @returns Absolute offsets of replacement feature tables, empty when no record matches.
 */
export function featureSubstitutions(
	table: LayoutTable,
	coordinates: readonly number[],
): Map<number, number> {
	let { reader, featureVariations } = table;
	let substitutions = new Map<number, number>();
	if (featureVariations === 0) return substitutions;
	let count = reader.u32(featureVariations + 4);
	for (let index = 0; index < count && index < 0xffff; index++) {
		let record = featureVariations + 8 + index * 8;
		let conditions = reader.u32(record);
		if (conditions !== 0 && !conditionsHold(reader, featureVariations + conditions, coordinates)) {
			continue;
		}
		let substitution = featureVariations + reader.u32(record + 4);
		let items = reader.u16(substitution + 4);
		for (let item = 0; item < items; item++) {
			let entry = substitution + 6 + item * 6;
			substitutions.set(reader.u16(entry), substitution + reader.u32(entry + 2));
		}
		return substitutions;
	}
	return substitutions;
}

/**
 * Whether every format 1 condition of a condition set holds; an unknown format fails it.
 *
 * @param reader - The font bytes.
 * @param offset - Absolute offset of the condition set.
 * @param coordinates - Normalized axis coordinates.
 */
function conditionsHold(reader: Reader, offset: number, coordinates: readonly number[]): boolean {
	let count = reader.u16(offset);
	for (let index = 0; index < count; index++) {
		let condition = offset + reader.u32(offset + 2 + index * 4);
		if (reader.u16(condition) !== 1) return false;
		let value = coordinates[reader.u16(condition + 2)] ?? 0;
		if (value < reader.f2dot14(condition + 4) || value > reader.f2dot14(condition + 6))
			return false;
	}
	return true;
}
