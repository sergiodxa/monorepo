/**
 * Parses a `CFF ` or `CFF2` table into its structures: the INDEXes, the Top, Font and
 * Private DICTs, the charset and FDSelect, each kept with the offsets it came from, so the
 * charstring interpreter draws glyphs from it and a subsetter can serialize its parts again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { FontError } from "../font-error.js";
import type { TableRecord } from "../font.js";
import type { Reader } from "../reader.js";

import { readItemVariationStore } from "../item-variation-store.js";

import type { CffDict } from "./dict.js";
import type { CffIndex } from "./index-table.js";

import { DICT_OP, readDict } from "./dict.js";
import { indexItem, malformed, readIndex } from "./index-table.js";
import {
	EXPERT_CHARSET,
	EXPERT_SUBSET_CHARSET,
	ISO_ADOBE_CHARSET,
	STANDARD_STRINGS,
} from "./standard.data.js";

/**
 * Glyph index to SID (or CID in a CID-keyed font). `predefined` is `0`–`2` for the ISOAdobe,
 * Expert and ExpertSubset charsets, which store nothing in the font; otherwise `format` and
 * `offset` locate the charset data.
 */
export interface CffCharset {
	readonly predefined: number | null;
	readonly format: number | null;
	readonly offset: number;
	/** `ids[glyph]`, the glyph's SID or CID; `0` past a predefined charset's end. */
	readonly ids: Uint32Array;
}

/** Glyph index to Font DICT, as read from format 0, 3 or 4. */
export interface CffFdSelect {
	readonly format: number;
	readonly offset: number;
	/** `fds[glyph]`, an index into `CffTable.fontDicts`. */
	readonly fds: Uint16Array;
}

/** A Private DICT, with the values charstrings depend on read out of it. */
export interface CffPrivate {
	/** Absolute offset of the DICT, `0` with `length` `0` for a font without one. */
	readonly offset: number;
	readonly length: number;
	readonly dict: CffDict;
	/** Local subroutines, `null` when the DICT names none. */
	readonly subrs: CffIndex | null;
	/** Width of a glyph whose charstring states none. */
	readonly defaultWidthX: number;
	/** Added to the width a charstring states. */
	readonly nominalWidthX: number;
	/** The ItemVariationStore subtable a CFF2 charstring blends with until it sets its own. */
	readonly vsindex: number;
}

/** One Font DICT of an FDArray, or the Top DICT's own Private DICT in a name-keyed font. */
export interface CffFontDict {
	/** The Font DICT, empty for a name-keyed font's single entry. */
	readonly dict: CffDict;
	readonly private: CffPrivate;
}

/** A parsed `CFF ` or `CFF2` table. */
export interface CffTable {
	readonly version: 1 | 2;
	readonly tag: "CFF " | "CFF2";
	/** Absolute offset and length of the table. */
	readonly offset: number;
	readonly length: number;
	/** Header size, where the first INDEX (CFF) or the Top DICT (CFF2) starts. */
	readonly headerSize: number;
	/** The Name INDEX, `null` in CFF2. */
	readonly names: CffIndex | null;
	readonly topDict: CffDict;
	/** The String INDEX, `null` in CFF2. */
	readonly strings: CffIndex | null;
	readonly globalSubrs: CffIndex;
	readonly charStrings: CffIndex;
	/** `null` in CFF2, whose glyph names live in `post`. */
	readonly charset: CffCharset | null;
	/** Whether the Top DICT carries `ROS`, making the charset map glyphs to CIDs. */
	readonly cid: boolean;
	/** The FDArray, or one entry holding a name-keyed font's Private DICT. */
	readonly fontDicts: readonly CffFontDict[];
	/** `null` when every glyph uses `fontDicts[0]`. */
	readonly fdSelect: CffFdSelect | null;
	/** Absolute offset of a CFF2 ItemVariationStore, `null` without one. */
	readonly variationStore: number | null;
	/** Deepest operand stack a charstring may build: 48 in CFF, `maxstack` in CFF2. */
	readonly maxStack: number;
}

/** Decodes String INDEX entries, which CFF stores as single-byte characters. */
const LATIN1 = new TextDecoder("latin1");

/** CFF's fixed operand stack limit. */
const CFF_MAX_STACK = 48;

/** CFF2's default `maxstack`, and the most this package lets a font raise it to. */
const CFF2_DEFAULT_MAX_STACK = 193;
const CFF2_MAX_STACK = 513;

/**
 * Parses the `CFF ` or `CFF2` table. A CharStrings INDEX whose count differs from
 * `numGlyphs`, a font without one, or more than one font in a `CFF ` table is `malformed`.
 *
 * @param reader - The whole file.
 * @param tables - The font's table directory.
 * @param numGlyphs - From `maxp`.
 */
export function parseCffTable(
	reader: Reader,
	tables: Map<string, TableRecord>,
	numGlyphs: number,
): Result<CffTable, FontError> {
	let cff2 = tables.get("CFF2");
	if (cff2 !== undefined) return parseCff2(reader, cff2, numGlyphs);
	let cff = tables.get("CFF ");
	if (cff === undefined) return malformed("The font has no CFF table.", "CFF ");
	return parseCff1(reader, cff, numGlyphs);
}

/**
 * Reads a version 1 table: header, Name, Top DICT, String and Global Subr INDEXes, then
 * what the Top DICT points at.
 *
 * @param reader - The whole file.
 * @param record - The `CFF ` table's location.
 * @param numGlyphs - From `maxp`.
 */
function parseCff1(
	reader: Reader,
	record: TableRecord,
	numGlyphs: number,
): Result<CffTable, FontError> {
	let tag = "CFF " as const;
	let start = record.offset;
	let limit = record.offset + record.length;
	if (record.length < 4 || reader.u8(start) !== 1) {
		return malformed("The CFF table has an unknown version.", tag);
	}
	let headerSize = reader.u8(start + 2);
	let names = readIndex(reader, start + headerSize, limit, false, tag);
	if (isFailure(names)) return names;
	let topDicts = readIndex(reader, names.data.end, limit, false, tag);
	if (isFailure(topDicts)) return topDicts;
	if (topDicts.data.count !== 1) return malformed("The CFF table must hold one font.", tag);
	let strings = readIndex(reader, topDicts.data.end, limit, false, tag);
	if (isFailure(strings)) return strings;
	let globalSubrs = readIndex(reader, strings.data.end, limit, false, tag);
	if (isFailure(globalSubrs)) return globalSubrs;

	let item = indexItem(topDicts.data, 0);
	if (item === null) return malformed("The CFF table has no Top DICT.", tag);
	let topDict = readDict(reader, item.offset, item.offset + item.length, tag);
	if (isFailure(topDict)) return topDict;
	let top = topDict.data;
	if ((top.get(DICT_OP.charstringType)?.[0] ?? 2) !== 2) {
		return malformed("The CFF table uses an unsupported charstring type.", tag);
	}

	let charStrings = readCharStrings(reader, top, start, limit, numGlyphs, false, tag);
	if (isFailure(charStrings)) return charStrings;
	let cid = top.has(DICT_OP.ros);
	let charset = readCharset(
		reader,
		top.get(DICT_OP.charset)?.[0] ?? 0,
		start,
		limit,
		numGlyphs,
		cid,
	);
	if (isFailure(charset)) return charset;

	let fonts = readFontDicts(reader, top, start, limit, cid, false, null);
	if (isFailure(fonts)) return fonts;
	let fdSelect = readFdSelect(reader, top, start, limit, numGlyphs, fonts.data.length, tag);
	if (isFailure(fdSelect)) return fdSelect;

	return success({
		version: 1,
		tag,
		offset: start,
		length: record.length,
		headerSize,
		names: names.data,
		topDict: top,
		strings: strings.data,
		globalSubrs: globalSubrs.data,
		charStrings: charStrings.data,
		charset: charset.data,
		cid,
		fontDicts: fonts.data,
		fdSelect: fdSelect.data,
		variationStore: null,
		maxStack: CFF_MAX_STACK,
	});
}

/**
 * Reads a version 2 table: header, the Top DICT the header sizes, the Global Subr INDEX,
 * then the FDArray, FDSelect and ItemVariationStore the Top DICT points at.
 *
 * @param reader - The whole file.
 * @param record - The `CFF2` table's location.
 * @param numGlyphs - From `maxp`.
 */
function parseCff2(
	reader: Reader,
	record: TableRecord,
	numGlyphs: number,
): Result<CffTable, FontError> {
	let tag = "CFF2" as const;
	let start = record.offset;
	let limit = record.offset + record.length;
	if (record.length < 5 || reader.u8(start) !== 2) {
		return malformed("The CFF2 table has an unknown version.", tag);
	}
	let headerSize = reader.u8(start + 2);
	let topLength = reader.u16(start + 3);
	let topStart = start + headerSize;
	if (topStart + topLength > limit) return malformed("The CFF2 Top DICT is truncated.", tag);
	let topDict = readDict(reader, topStart, topStart + topLength, tag);
	if (isFailure(topDict)) return topDict;
	let top = topDict.data;
	let globalSubrs = readIndex(reader, topStart + topLength, limit, true, tag);
	if (isFailure(globalSubrs)) return globalSubrs;

	let charStrings = readCharStrings(reader, top, start, limit, numGlyphs, true, tag);
	if (isFailure(charStrings)) return charStrings;

	let vstoreOperand = top.get(DICT_OP.vstore)?.[0];
	let variationStore = vstoreOperand === undefined ? null : start + vstoreOperand + 2;
	if (variationStore !== null && variationStore >= limit) {
		return malformed("The CFF2 VariationStore is past the end of the table.", tag);
	}
	let store = variationStore === null ? null : readItemVariationStore(reader, variationStore);
	let regions = (vsindex: number): number => store?.data[vsindex]?.regionIndexes.length ?? 0;

	let fonts = readFontDicts(reader, top, start, limit, true, true, regions);
	if (isFailure(fonts)) return fonts;
	let fdSelect = readFdSelect(reader, top, start, limit, numGlyphs, fonts.data.length, tag);
	if (isFailure(fdSelect)) return fdSelect;

	let maxStack = Math.min(top.get(DICT_OP.maxstack)?.[0] ?? CFF2_DEFAULT_MAX_STACK, CFF2_MAX_STACK);
	return success({
		version: 2,
		tag,
		offset: start,
		length: record.length,
		headerSize,
		names: null,
		topDict: top,
		strings: null,
		globalSubrs: globalSubrs.data,
		charStrings: charStrings.data,
		charset: null,
		cid: false,
		fontDicts: fonts.data,
		fdSelect: fdSelect.data,
		variationStore,
		maxStack,
	});
}

/**
 * The CharStrings INDEX the Top DICT points at, which must hold one charstring per glyph.
 *
 * @param reader - The whole file.
 * @param top - The Top DICT.
 * @param start - Absolute offset of the table, which DICT offsets count from.
 * @param limit - Absolute end of the table.
 * @param numGlyphs - From `maxp`.
 * @param cff2 - Whether INDEX counts are 32-bit.
 * @param tag - The table tag errors name.
 */
function readCharStrings(
	reader: Reader,
	top: CffDict,
	start: number,
	limit: number,
	numGlyphs: number,
	cff2: boolean,
	tag: string,
): Result<CffIndex, FontError> {
	let offset = top.get(DICT_OP.charStrings)?.[0];
	if (offset === undefined) return malformed("The font has no CharStrings INDEX.", tag);
	let charStrings = readIndex(reader, start + offset, limit, cff2, tag);
	if (isFailure(charStrings)) return charStrings;
	if (charStrings.data.count !== numGlyphs) {
		return malformed("The CharStrings INDEX does not hold one charstring per glyph.", tag);
	}
	return charStrings;
}

/**
 * Reads the charset: a predefined one by number, or format 0 (one SID per glyph), 1 or 2
 * (ranges of consecutive SIDs with an 8- or 16-bit length). Glyph 0 is always `.notdef`.
 *
 * @param reader - The whole file.
 * @param operand - The Top DICT's `charset` operand, `0`–`2` or an offset.
 * @param start - Absolute offset of the table.
 * @param limit - Absolute end of the table.
 * @param numGlyphs - Glyph count.
 * @param cid - Whether ids are CIDs, which a predefined charset never describes.
 */
function readCharset(
	reader: Reader,
	operand: number,
	start: number,
	limit: number,
	numGlyphs: number,
	cid: boolean,
): Result<CffCharset, FontError> {
	let ids = new Uint32Array(numGlyphs);
	if (operand <= 2 && !cid) {
		let table = predefinedCharset(operand);
		for (let glyph = 0; glyph < numGlyphs; glyph++) ids[glyph] = table[glyph] ?? 0;
		return success({ predefined: operand, format: null, offset: 0, ids });
	}
	let offset = start + operand;
	let format = reader.u8(offset);
	let position = offset + 1;
	if (format === 0) {
		if (position + (numGlyphs - 1) * 2 > limit)
			return malformed("The charset is truncated.", "CFF ");
		for (let glyph = 1; glyph < numGlyphs; glyph++) {
			ids[glyph] = reader.u16(position);
			position += 2;
		}
		return success({ predefined: null, format, offset, ids });
	}
	if (format !== 1 && format !== 2) return malformed("The charset has an unknown format.", "CFF ");
	let glyph = 1;
	let rangeSize = format === 1 ? 3 : 4;
	while (glyph < numGlyphs) {
		if (position + rangeSize > limit) return malformed("The charset is truncated.", "CFF ");
		let first = reader.u16(position);
		let left = format === 1 ? reader.u8(position + 2) : reader.u16(position + 2);
		position += rangeSize;
		for (let step = 0; step <= left && glyph < numGlyphs; step++) {
			ids[glyph] = first + step;
			glyph++;
		}
	}
	return success({ predefined: null, format, offset, ids });
}

/**
 * One of the three charsets the CFF specification predefines, as SIDs by glyph.
 *
 * @param id - `0` ISOAdobe, `1` Expert, `2` ExpertSubset.
 */
function predefinedCharset(id: number): readonly number[] {
	if (id === 1) return EXPERT_CHARSET;
	if (id === 2) return EXPERT_SUBSET_CHARSET;
	return ISO_ADOBE_CHARSET;
}

/**
 * The FDArray's Font DICTs and their Private DICTs; a name-keyed CFF font answers one entry
 * holding the Top DICT's own Private DICT.
 *
 * @param reader - The whole file.
 * @param top - The Top DICT.
 * @param start - Absolute offset of the table.
 * @param limit - Absolute end of the table.
 * @param keyed - Whether the font has an FDArray (CID-keyed CFF, every CFF2).
 * @param cff2 - Whether INDEX counts are 32-bit and DICTs may blend.
 * @param regions - Region count by ItemVariationStore subtable, for CFF2 `blend`.
 */
function readFontDicts(
	reader: Reader,
	top: CffDict,
	start: number,
	limit: number,
	keyed: boolean,
	cff2: boolean,
	regions: ((vsindex: number) => number) | null,
): Result<CffFontDict[], FontError> {
	let tag = cff2 ? "CFF2" : "CFF ";
	if (!keyed) {
		let only = readPrivate(reader, top.get(DICT_OP.private), start, limit, tag, null);
		if (isFailure(only)) return only;
		return success([{ dict: new Map(), private: only.data }]);
	}
	let offset = top.get(DICT_OP.fdArray)?.[0];
	if (offset === undefined) return malformed("The font has no FDArray.", tag);
	let array = readIndex(reader, start + offset, limit, cff2, tag);
	if (isFailure(array)) return array;
	if (array.data.count === 0) return malformed("The FDArray is empty.", tag);
	let fonts: CffFontDict[] = [];
	for (let index = 0; index < array.data.count; index++) {
		let item = indexItem(array.data, index);
		if (item === null) break;
		let dict = readDict(reader, item.offset, item.offset + item.length, tag);
		if (isFailure(dict)) return dict;
		let found = readPrivate(reader, dict.data.get(DICT_OP.private), start, limit, tag, regions);
		if (isFailure(found)) return found;
		fonts.push({ dict: dict.data, private: found.data });
	}
	return success(fonts);
}

/**
 * Reads a Private DICT from the `Private` operator's size and offset, and the local Subrs
 * INDEX its `Subrs` operator places relative to the DICT; no operator gives the defaults.
 *
 * @param reader - The whole file.
 * @param operands - `[size, offset]`, offset from the table start.
 * @param start - Absolute offset of the table.
 * @param limit - Absolute end of the table.
 * @param tag - The table tag errors name.
 * @param regions - Region count by ItemVariationStore subtable, for CFF2 `blend`.
 */
function readPrivate(
	reader: Reader,
	operands: number[] | undefined,
	start: number,
	limit: number,
	tag: string,
	regions: ((vsindex: number) => number) | null,
): Result<CffPrivate, FontError> {
	let size = operands?.[0] ?? 0;
	let offset = start + (operands?.[1] ?? 0);
	if (operands === undefined || size === 0) {
		return success({
			offset: 0,
			length: 0,
			dict: new Map(),
			subrs: null,
			defaultWidthX: 0,
			nominalWidthX: 0,
			vsindex: 0,
		});
	}
	if (size < 0 || offset + size > limit) return malformed("A Private DICT is truncated.", tag);
	let dict = readDict(reader, offset, offset + size, tag, regions ?? undefined);
	if (isFailure(dict)) return dict;
	let subrsOperand = dict.data.get(DICT_OP.subrs)?.[0];
	let subrs: CffIndex | null = null;
	if (subrsOperand !== undefined) {
		let index = readIndex(reader, offset + subrsOperand, limit, tag === "CFF2", tag);
		if (isFailure(index)) return index;
		subrs = index.data;
	}
	return success({
		offset,
		length: size,
		dict: dict.data,
		subrs,
		defaultWidthX: dict.data.get(DICT_OP.defaultWidthX)?.[0] ?? 0,
		nominalWidthX: dict.data.get(DICT_OP.nominalWidthX)?.[0] ?? 0,
		vsindex: dict.data.get(DICT_OP.vsindex)?.[0] ?? 0,
	});
}

/**
 * Reads FDSelect format 0 (one byte per glyph), 3 (16-bit ranges) or 4 (CFF2's 32-bit
 * ranges). Ranges must start at glyph 0 and increase, and every Font DICT index must exist.
 *
 * @param reader - The whole file.
 * @param top - The Top DICT.
 * @param start - Absolute offset of the table.
 * @param limit - Absolute end of the table.
 * @param numGlyphs - Glyph count.
 * @param fontCount - How many Font DICTs the FDArray holds.
 * @param tag - The table tag errors name.
 */
function readFdSelect(
	reader: Reader,
	top: CffDict,
	start: number,
	limit: number,
	numGlyphs: number,
	fontCount: number,
	tag: string,
): Result<CffFdSelect | null, FontError> {
	let operand = top.get(DICT_OP.fdSelect)?.[0];
	if (operand === undefined || !top.has(DICT_OP.fdArray)) return success(null);
	let offset = start + operand;
	let format = reader.u8(offset);
	let fds = new Uint16Array(numGlyphs);
	if (format === 0) {
		if (offset + 1 + numGlyphs > limit) return malformed("The FDSelect is truncated.", tag);
		for (let glyph = 0; glyph < numGlyphs; glyph++) {
			let fd = reader.u8(offset + 1 + glyph);
			if (fd >= fontCount) return malformed("The FDSelect names a missing Font DICT.", tag);
			fds[glyph] = fd;
		}
		return success({ format, offset, fds });
	}
	if (format !== 3 && format !== 4) return malformed("The FDSelect has an unknown format.", tag);
	let wide = format === 4;
	let count = wide ? reader.u32(offset + 1) : reader.u16(offset + 1);
	let rangeSize = wide ? 6 : 3;
	let ranges = offset + (wide ? 5 : 3);
	if (ranges + count * rangeSize + (wide ? 4 : 2) > limit) {
		return malformed("The FDSelect is truncated.", tag);
	}
	for (let index = 0; index < count; index++) {
		let at = ranges + index * rangeSize;
		let first = wide ? reader.u32(at) : reader.u16(at);
		let fd = wide ? reader.u16(at + 4) : reader.u8(at + 2);
		let next = wide ? reader.u32(at + rangeSize) : reader.u16(at + rangeSize);
		if ((index === 0 && first !== 0) || next < first) {
			return malformed("The FDSelect ranges are out of order.", tag);
		}
		if (fd >= fontCount) return malformed("The FDSelect names a missing Font DICT.", tag);
		fds.fill(fd, first, Math.min(next, numGlyphs));
	}
	return success({ format, offset, fds });
}

/**
 * The string a SID names: one of the 391 standard strings, or an entry of the font's String
 * INDEX; `null` past both.
 *
 * @param reader - The whole file.
 * @param table - The parsed table.
 * @param sid - String id.
 */
export function cffString(reader: Reader, table: CffTable, sid: number): string | null {
	let standard = STANDARD_STRINGS[sid];
	if (standard !== undefined) return standard;
	if (table.strings === null) return null;
	let item = indexItem(table.strings, sid - STANDARD_STRINGS.length);
	if (item === null) return null;
	return LATIN1.decode(reader.bytes(item.offset, item.length));
}
