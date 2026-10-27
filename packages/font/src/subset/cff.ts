/**
 * Writes an OpenType font with CFF outlines holding only the glyphs a document draws. A
 * `CFF ` font keeps its charstrings and the subroutines they call byte for byte; a `CFF2` font
 * or an instance is drawn and re-encoded, so every subset is a version 1 `CFF ` table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CffIndex, CffOutlines, CffTable } from "../cff/index.js";
import type { Font, FontData } from "../font.js";
import type { Reader } from "../reader.js";

import { cffString, DICT_OP, indexItem } from "../cff/index.js";
import { STANDARD_ENCODING } from "../cff/standard.data.js";
import { variationOf } from "../variations/variation.js";

import type { DictEntry } from "./cff-encoding.js";
import type { HorizontalMetric, TableBytes } from "./sfnt-writer.js";

import { encodeDict, encodeIndex, keptEntries, StringTable } from "./cff-encoding.js";
import { encodeCharstring } from "./charstring-encoder.js";
import {
	assemble,
	copyTable,
	emptyCmap,
	headTable,
	hheaTable,
	hmtxTable,
	maxpCffTable,
	OPENTYPE_CFF,
	postTable,
	sourceMetric,
} from "./sfnt-writer.js";
import { subroutineUse } from "./subroutines.js";

/** The source font a CFF subset reads: its tables, its outlines, and the `Font` drawing them. */
export interface CffSource {
	font: Font;
	data: FontData;
	cff: CffOutlines;
}

/** One Font DICT of the written table, with its Private DICT and local subroutines. */
interface WrittenFont {
	dict: DictEntry[];
	private: DictEntry[];
	subrs: Uint8Array[] | null;
}

/** Everything a version 1 `CFF ` table holds, before offsets are known. */
interface CffParts {
	name: Uint8Array;
	/** Top DICT entries other than the offsets `writeCff` adds. */
	top: DictEntry[];
	strings: StringTable;
	globalSubrs: Uint8Array[];
	charset: Uint8Array;
	charStrings: Uint8Array[];
	fonts: WrittenFont[];
	/** FDSelect bytes; `null` writes a name-keyed font whose one Private DICT is `fonts[0]`. */
	fdSelect: Uint8Array | null;
}

/** A finished subset's `CFF ` table and each glyph's horizontal metric. */
interface CffSubset {
	table: Uint8Array;
	metrics: HorizontalMetric[];
}

/** Operators whose operand is a SID, which a subset renumbers into its own String INDEX. */
const SID_OPERATORS = new Set([0, 1, 2, 3, 4, 1200, 1221, 1222, 1238]);

/** Top DICT operators the writer sets itself, or omits because they name the source font. */
const TOP_REWRITTEN = new Set([
	DICT_OP.charset,
	DICT_OP.encoding,
	DICT_OP.charStrings,
	DICT_OP.private,
	DICT_OP.vstore,
	DICT_OP.maxstack,
	DICT_OP.ros,
	DICT_OP.cidCount,
	DICT_OP.fdArray,
	DICT_OP.fdSelect,
	1220,
]);

/** Private DICT operators the writer sets itself (`Subrs`) or that CFF2 alone defines. */
const PRIVATE_REWRITTEN = new Set([DICT_OP.subrs, DICT_OP.vsindex, DICT_OP.blend]);

/** Private DICT operators a re-encoded charstring makes moot, since it states its width. */
const WIDTH_OPERATORS = [DICT_OP.defaultWidthX, DICT_OP.nominalWidthX];

/** A subroutine replaced by `return`, which keeps the numbering of the ones kept. */
const EMPTY_SUBROUTINE = Uint8Array.of(11);

/** Marks a DICT entry whose operands are offsets, written as fixed five-byte integers. */
const FIXED = true;

/**
 * Writes the subset font: `.notdef`, then `requested` in order without repeats or ids the
 * font lacks, then the glyphs `seac` accents compose from.
 *
 * @param source - The source font.
 * @param requested - Original glyph ids.
 * @returns The `.otf` bytes and the subset's glyphs as original ids, indexed by new id.
 */
export function subsetCff(
	source: CffSource,
	requested: Iterable<number>,
): { bytes: Uint8Array; order: number[] } {
	let { data, cff } = source;
	let order = glyphOrder(data.numGlyphs, requested);
	let instanced = variationOf(data) !== null;
	let converted = cff.kind === "cff2" || instanced;
	let subset = converted ? convertedCff(source, order) : copiedCff(data, cff.table, order);
	let tables: TableBytes[] = [
		{ tag: "head", bytes: headTable(data) },
		{ tag: "hhea", bytes: hheaTable(data, order.length, instanced ? source.font : null) },
		{ tag: "maxp", bytes: maxpCffTable(order.length) },
		{ tag: "hmtx", bytes: hmtxTable(subset.metrics) },
		{ tag: "CFF ", bytes: subset.table },
		{ tag: "post", bytes: postTable(data) },
		{ tag: "cmap", bytes: emptyCmap() },
	];
	for (let tag of ["name", "OS/2"]) {
		if (data.tables.has(tag)) tables.push({ tag, bytes: copyTable(data, tag) });
	}
	return { bytes: assemble(tables, OPENTYPE_CFF), order };
}

/**
 * The subset's glyphs as original ids: `0`, then each valid requested id once.
 *
 * @param numGlyphs - Glyphs in the source font.
 * @param requested - Original ids in the caller's order.
 */
export function glyphOrder(numGlyphs: number, requested: Iterable<number>): number[] {
	let order = [0];
	let seen = new Set(order);
	for (let glyph of requested) {
		if (!Number.isInteger(glyph) || glyph < 0 || glyph >= numGlyphs || seen.has(glyph)) continue;
		seen.add(glyph);
		order.push(glyph);
	}
	return order;
}

/**
 * A `CFF ` subset that copies the source's charstrings. Subroutines no kept glyph calls are
 * emptied; a charstring that computes values keeps every subroutine. `order` grows by the
 * glyphs `seac` accents compose from, which the subset's charset must still name.
 *
 * @param data - The source font.
 * @param table - Its parsed `CFF ` table.
 * @param order - The subset's glyphs as original ids.
 */
function copiedCff(data: FontData, table: CffTable, order: number[]): CffSubset {
	let reader = data.reader;
	addSeacGlyphs(table, order, subroutineUse(reader, table, order).seacCodes);
	let use = subroutineUse(reader, table, order);
	let strings = new StringTable();
	let sid = (value: number): number => strings.add(cffString(reader, table, value) ?? "");

	let top: DictEntry[] = [];
	if (table.cid) top.push(identityRos(strings));
	top.push(...remapSids(keptEntries(table.topDict, TOP_REWRITTEN), sid));
	if (table.cid) top.push({ op: DICT_OP.cidCount, operands: [order.length] });

	let fonts: WrittenFont[];
	let fdSelect: Uint8Array | null = null;
	let charset: Uint8Array;
	if (table.cid) {
		let selection = selectFonts(table, order);
		fonts = selection.used.map((fd) => {
			let found = table.fontDicts[fd];
			let subrs = found?.private.subrs ?? null;
			return {
				dict: remapSids(keptEntries(found?.dict ?? new Map(), new Set([DICT_OP.private])), sid),
				private: keptEntries(found?.private.dict ?? new Map(), PRIVATE_REWRITTEN),
				subrs: subrs === null ? null : pruned(reader, subrs, use.local.get(fd), use.dynamic),
			};
		});
		fdSelect = fdSelectRanges(selection.fds);
		charset = identityCharset(order.length);
	} else {
		let only = table.fontDicts[0]?.private;
		let subrs = only?.subrs ?? null;
		fonts = [
			{
				dict: [],
				private: keptEntries(only?.dict ?? new Map(), PRIVATE_REWRITTEN),
				subrs: subrs === null ? null : pruned(reader, subrs, use.local.get(0), use.dynamic),
			},
		];
		charset = namedCharset(order, (glyph) => sid(table.charset?.ids[glyph] ?? 0));
	}

	let nameItem = table.names === null ? null : indexItem(table.names, 0);
	let parts: CffParts = {
		name: nameItem === null ? new Uint8Array() : reader.bytes(nameItem.offset, nameItem.length),
		top,
		strings,
		globalSubrs: pruned(reader, table.globalSubrs, use.global, use.dynamic),
		charset,
		charStrings: order.map((glyph) => itemBytes(reader, table.charStrings, glyph)),
		fonts,
		fdSelect,
	};
	return { table: writeCff(parts), metrics: order.map((glyph) => sourceMetric(data, glyph)) };
}

/**
 * A `CFF ` subset of glyphs drawn through the `Font` and re-encoded: a `CFF2` font at its
 * default location or at the instance the font was varied to. It is CID-keyed with one
 * Font DICT per source Font DICT in use, and carries no hints or subroutines.
 *
 * @param source - The source font.
 * @param order - The subset's glyphs as original ids.
 */
function convertedCff(source: CffSource, order: readonly number[]): CffSubset {
	let { font, data } = source;
	let table = source.cff.table;
	let instanced = variationOf(data) !== null;
	let metrics = order.map((glyph): HorizontalMetric => {
		if (!instanced) return sourceMetric(data, glyph);
		return { advance: font.advance(glyph), bearing: font.glyphCBox(glyph).xMin };
	});
	let strings = new StringTable();
	let selection = selectFonts(table, order);
	let fonts = selection.used.map((fd) => {
		let found = table.fontDicts[fd];
		let dropped = new Set([...PRIVATE_REWRITTEN, ...WIDTH_OPERATORS]);
		return {
			dict: keptEntries(found?.dict ?? new Map(), new Set([DICT_OP.private, ...SID_OPERATORS])),
			private: keptEntries(found?.private.dict ?? new Map(), dropped),
			subrs: null,
		};
	});
	let top: DictEntry[] = [
		identityRos(strings),
		...keptEntries(table.topDict, new Set([...TOP_REWRITTEN, ...SID_OPERATORS])),
		{ op: DICT_OP.cidCount, operands: [order.length] },
	];
	let parts: CffParts = {
		name: Uint8Array.from(postscriptName(font.postscriptName), (char) => char.charCodeAt(0)),
		top,
		strings,
		globalSubrs: [],
		charset: identityCharset(order.length),
		charStrings: order.map((glyph, index) =>
			encodeCharstring(font.outline(glyph), metrics[index]?.advance ?? 0),
		),
		fonts,
		fdSelect: fdSelectRanges(selection.fds),
	};
	return { table: writeCff(parts), metrics };
}

/**
 * Appends the base and accent glyphs `seac` composes from, found by the Standard encoding
 * code's SID in the charset, so the subset's own charset can still resolve them.
 *
 * @param table - The parsed table.
 * @param order - The subset's glyphs, extended in place.
 * @param codes - Standard encoding codes the kept glyphs compose from.
 */
function addSeacGlyphs(table: CffTable, order: number[], codes: ReadonlySet<number>): void {
	let charset = table.charset;
	if (charset === null || table.cid || codes.size === 0) return;
	let seen = new Set(order);
	for (let code of codes) {
		let sid = STANDARD_ENCODING[code] ?? 0;
		if (sid === 0) continue;
		let glyph = charset.ids.indexOf(sid, 1);
		if (glyph < 0 || seen.has(glyph)) continue;
		seen.add(glyph);
		order.push(glyph);
	}
}

/**
 * The source Font DICTs the subset uses, in order of first use, and each subset glyph's
 * index into that list.
 *
 * @param table - The parsed table.
 * @param order - The subset's glyphs as original ids.
 */
function selectFonts(table: CffTable, order: readonly number[]): { used: number[]; fds: number[] } {
	let used: number[] = [];
	let renumbered = new Map<number, number>();
	let fds = order.map((glyph) => {
		let fd = table.fdSelect?.fds[glyph] ?? 0;
		let found = renumbered.get(fd);
		if (found !== undefined) return found;
		renumbered.set(fd, used.length);
		used.push(fd);
		return used.length - 1;
	});
	return { used, fds };
}

/**
 * `ROS` naming the Adobe Identity ordering: a subset's CIDs are its glyph ids, so a
 * document addresses each glyph by the id `glyphId()` answers.
 *
 * @param strings - The subset's String INDEX.
 */
function identityRos(strings: StringTable): DictEntry {
	return { op: DICT_OP.ros, operands: [strings.add("Adobe"), strings.add("Identity"), 0] };
}

/**
 * Entries with every SID operand renumbered into the subset's String INDEX.
 *
 * @param entries - DICT entries holding source SIDs.
 * @param sid - The subset SID of a source SID.
 */
function remapSids(entries: DictEntry[], sid: (value: number) => number): DictEntry[] {
	return entries.map(({ op, operands }) => {
		if (!SID_OPERATORS.has(op)) return { op, operands };
		return { op, operands: operands.map((value) => sid(value)) };
	});
}

/**
 * Every item of a subroutine INDEX, the uncalled ones replaced by `return`.
 *
 * @param reader - The whole file.
 * @param subrs - The source INDEX.
 * @param used - Indexes the kept glyphs call.
 * @param keepAll - Keep every subroutine whole.
 */
function pruned(
	reader: Reader,
	subrs: CffIndex,
	used: ReadonlySet<number> | undefined,
	keepAll: boolean,
): Uint8Array[] {
	return Array.from({ length: subrs.count }, (_, index) =>
		keepAll || used?.has(index) === true ? itemBytes(reader, subrs, index) : EMPTY_SUBROUTINE,
	);
}

/**
 * The bytes of one INDEX item.
 *
 * @param reader - The whole file.
 * @param index - The INDEX.
 * @param item - Item number.
 */
function itemBytes(reader: Reader, index: CffIndex, item: number): Uint8Array {
	let found = indexItem(index, item);
	return found === null ? new Uint8Array() : reader.bytes(found.offset, found.length);
}

/**
 * Charset format 0: the subset SID of each glyph after `.notdef`.
 *
 * @param order - The subset's glyphs as original ids.
 * @param sid - The subset SID naming an original glyph.
 */
function namedCharset(order: readonly number[], sid: (glyph: number) => number): Uint8Array {
	let bytes = new Uint8Array(1 + (order.length - 1) * 2);
	let view = new DataView(bytes.buffer);
	order.slice(1).forEach((glyph, index) => view.setUint16(1 + index * 2, sid(glyph)));
	return bytes;
}

/**
 * Charset format 2 with one range mapping glyph `n` to CID `n`; format 0 with no entries for
 * a subset of `.notdef` alone.
 *
 * @param count - Glyphs in the subset.
 */
function identityCharset(count: number): Uint8Array {
	if (count < 2) return Uint8Array.of(0);
	let left = count - 2;
	return Uint8Array.of(2, 0, 1, (left >> 8) & 0xff, left & 0xff);
}

/**
 * FDSelect format 3: one range per run of glyphs sharing a Font DICT, then the sentinel.
 *
 * @param fds - Each subset glyph's Font DICT index.
 */
function fdSelectRanges(fds: readonly number[]): Uint8Array {
	let ranges: { first: number; fd: number }[] = [];
	fds.forEach((fd, glyph) => {
		if (ranges.at(-1)?.fd !== fd) ranges.push({ first: glyph, fd });
	});
	let bytes = new Uint8Array(5 + ranges.length * 3);
	let view = new DataView(bytes.buffer);
	view.setUint8(0, 3);
	view.setUint16(1, ranges.length);
	ranges.forEach(({ first, fd }, index) => {
		view.setUint16(3 + index * 3, first);
		view.setUint8(5 + index * 3, fd);
	});
	view.setUint16(3 + ranges.length * 3, fds.length);
	return bytes;
}

/**
 * A PostScript name for the Name INDEX: printable ASCII without the characters PostScript
 * reserves, at most 127 of them, `Subset` when nothing is left.
 *
 * @param name - The font's PostScript name.
 */
function postscriptName(name: string): string {
	let cleaned = name.replace(/[^!-~]|[[\](){}<>/%]/g, "").slice(0, 127);
	return cleaned === "" ? "Subset" : cleaned;
}

/**
 * Serializes a version 1 `CFF ` table: header, Name, Top DICT, String and Global Subr
 * INDEXes, then the charset, FDSelect, CharStrings, FDArray and each Private DICT followed
 * by its Subrs. Offsets are fixed-width, so one sizing pass places everything.
 *
 * @param parts - The table's contents.
 */
function writeCff(parts: CffParts): Uint8Array {
	let sized = layoutCff(parts, null);
	return layoutCff(parts, sized.offsets).bytes;
}

/** Where `layoutCff` placed the structures DICTs point at, from the table start. */
interface CffOffsets {
	charset: number;
	fdSelect: number;
	charStrings: number;
	fdArray: number;
	privates: number[];
}

/**
 * Builds the table with the given offsets, or zeros when sizing, and reports where each
 * structure landed.
 *
 * @param parts - The table's contents.
 * @param offsets - Offsets from a sizing pass, `null` for that pass.
 */
function layoutCff(
	parts: CffParts,
	offsets: CffOffsets | null,
): { bytes: Uint8Array; offsets: CffOffsets } {
	let privates = parts.fonts.map((font) => privateDict(font));
	let cid = parts.fdSelect !== null;
	let top: DictEntry[] = [
		...parts.top,
		{ op: DICT_OP.charset, operands: [offsets?.charset ?? 0], fixed: FIXED },
		{ op: DICT_OP.charStrings, operands: [offsets?.charStrings ?? 0], fixed: FIXED },
	];
	if (cid) {
		top.push({ op: DICT_OP.fdArray, operands: [offsets?.fdArray ?? 0], fixed: FIXED });
		top.push({ op: DICT_OP.fdSelect, operands: [offsets?.fdSelect ?? 0], fixed: FIXED });
	} else {
		let size = privates[0]?.length ?? 0;
		let at = offsets?.privates[0] ?? 0;
		top.push({ op: DICT_OP.private, operands: [size, at], fixed: FIXED });
	}
	let fontDicts = parts.fonts.map((font, index) =>
		encodeDict([
			...font.dict,
			{
				op: DICT_OP.private,
				operands: [privates[index]?.length ?? 0, offsets?.privates[index] ?? 0],
				fixed: FIXED,
			},
		]),
	);

	let blocks: Uint8Array[] = [
		Uint8Array.of(1, 0, 4, 4),
		encodeIndex([parts.name]),
		encodeIndex([encodeDict(top)]),
		parts.strings.encode(),
		encodeIndex(parts.globalSubrs),
	];
	let position = blocks.reduce((total, block) => total + block.length, 0);
	let place = (block: Uint8Array): number => {
		let at = position;
		blocks.push(block);
		position += block.length;
		return at;
	};
	let charset = place(parts.charset);
	let fdSelect = parts.fdSelect === null ? 0 : place(parts.fdSelect);
	let charStrings = place(encodeIndex(parts.charStrings));
	let fdArray = cid ? place(encodeIndex(fontDicts)) : 0;
	let placed = parts.fonts.map((font, index) => {
		let at = place(privates[index] ?? new Uint8Array());
		if (font.subrs !== null) place(encodeIndex(font.subrs));
		return at;
	});

	let bytes = new Uint8Array(position);
	let offset = 0;
	for (let block of blocks) {
		bytes.set(block, offset);
		offset += block.length;
	}
	return { bytes, offsets: { charset, fdSelect, charStrings, fdArray, privates: placed } };
}

/**
 * A Private DICT's bytes; with local subroutines, `Subrs` points just past the DICT, where
 * `layoutCff` places them.
 *
 * @param font - The Font DICT it belongs to.
 */
function privateDict(font: WrittenFont): Uint8Array {
	if (font.subrs === null) return encodeDict(font.private);
	let withoutSubrs = encodeDict(font.private);
	let subrs: DictEntry = { op: DICT_OP.subrs, operands: [0], fixed: FIXED };
	let size = withoutSubrs.length + encodeDict([subrs]).length;
	return encodeDict([...font.private, { ...subrs, operands: [size] }]);
}
