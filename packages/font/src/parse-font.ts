/**
 * `parseFont` turns TrueType bytes into a `Font`. It reads the table directory and the
 * fixed-size headers, checks every size later lookups rely on, and leaves glyph data, cmap
 * subtables and kerning on the bytes, so opening a font is a handful of reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { TableRecord } from "./font.js";

import { FontError } from "./font-error.js";
import { Font } from "./font.js";
import { readMetrics } from "./metrics.js";
import { Reader } from "./reader.js";
import { selectCmap } from "./tables.js";

/** Tables every TrueType-outline font carries and this package reads. */
const REQUIRED_TABLES = ["head", "hhea", "maxp", "hmtx", "cmap", "loca", "glyf"] as const;

/** `head.magicNumber`, which tells a real `head` table from bytes at the wrong offset. */
const HEAD_MAGIC = 0x5f0f3cf5;

/** `OS/2.fsSelection` bit telling layout to use the typographic metrics over `hhea`'s. */
const USE_TYPO_METRICS = 0x0080;

/**
 * Reads a TrueType font (`.ttf`, or an OpenType font with `glyf` outlines).
 *
 * @param bytes - The whole font file.
 * @returns The font, or a `FontError` whose `code` is `unsupported` for CFF (`OTTO`) and
 *   collection (`ttcf`) files, `missing-table`, or `malformed`.
 * @example let result = parseFont(await file.arrayBuffer());
 */
export function parseFont(bytes: Uint8Array | ArrayBuffer): Result<Font, FontError> {
	let reader = new Reader(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
	if (reader.length < 12) return malformed("The file is too short to be a font.");

	let version = reader.tag(0);
	if (version === "OTTO") {
		return failure(new FontError("unsupported", "CFF-outline fonts (OTTO) are not supported."));
	}
	if (version === "ttcf") {
		return failure(new FontError("unsupported", "Font collections (ttcf) are not supported."));
	}
	if (reader.u32(0) !== 0x00010000 && version !== "true") {
		return malformed("The file does not start with a TrueType signature.");
	}

	let count = reader.u16(4);
	if (12 + count * 16 > reader.length) return malformed("The table directory is truncated.");
	let tables = new Map<string, TableRecord>();
	for (let index = 0; index < count; index++) {
		let record = 12 + index * 16;
		let tag = reader.tag(record);
		let offset = reader.u32(record + 8);
		let length = reader.u32(record + 12);
		if (offset + length > reader.length) {
			return malformed(`The ${tag} table extends past the end of the file.`, tag);
		}
		tables.set(tag, { offset, length });
	}

	for (let tag of REQUIRED_TABLES) {
		if (!tables.has(tag)) {
			return failure(new FontError("missing-table", `The font has no ${tag} table.`, tag));
		}
	}
	let head = required(tables, "head");
	let hhea = required(tables, "hhea");
	let maxp = required(tables, "maxp");
	let hmtx = required(tables, "hmtx");
	let cmap = required(tables, "cmap");
	let loca = required(tables, "loca");
	let glyf = required(tables, "glyf");

	if (head.length < 54 || reader.u32(head.offset + 12) !== HEAD_MAGIC) {
		return malformed("The head table is invalid.", "head");
	}
	let unitsPerEm = reader.u16(head.offset + 18);
	let indexToLocFormat = reader.i16(head.offset + 50);
	if (unitsPerEm < 16 || unitsPerEm > 16384) {
		return malformed(`unitsPerEm ${unitsPerEm} is outside 16–16384.`, "head");
	}
	if (indexToLocFormat !== 0 && indexToLocFormat !== 1) {
		return malformed(`indexToLocFormat ${indexToLocFormat} is neither 0 nor 1.`, "head");
	}

	if (maxp.length < 6) return malformed("The maxp table is truncated.", "maxp");
	let numGlyphs = reader.u16(maxp.offset + 4);
	if (numGlyphs === 0) return malformed("The font has no glyphs.", "maxp");

	if (hhea.length < 36) return malformed("The hhea table is truncated.", "hhea");
	let numberOfHMetrics = reader.u16(hhea.offset + 34);
	if (numberOfHMetrics === 0 || numberOfHMetrics > numGlyphs) {
		return malformed(`numberOfHMetrics ${numberOfHMetrics} is out of range.`, "hhea");
	}
	if (hmtx.length < numberOfHMetrics * 4) {
		return malformed("The hmtx table is shorter than hhea declares.", "hmtx");
	}
	if (loca.length < (numGlyphs + 1) * (indexToLocFormat === 0 ? 2 : 4)) {
		return malformed("The loca table is shorter than maxp declares.", "loca");
	}

	let subtable = selectCmap(reader, cmap.offset, cmap.length);
	if (subtable === null) {
		return failure(
			new FontError(
				"unsupported",
				"The cmap table has no Unicode format 4 or 12 subtable.",
				"cmap",
			),
		);
	}

	let ascender = reader.i16(hhea.offset + 4);
	let descender = reader.i16(hhea.offset + 6);
	let lineGap = reader.i16(hhea.offset + 8);
	let os2 = tables.get("OS/2");
	if (os2 !== undefined && os2.length >= 78) {
		if (reader.u16(os2.offset + 62) & USE_TYPO_METRICS) {
			ascender = reader.i16(os2.offset + 68);
			descender = reader.i16(os2.offset + 70);
			lineGap = reader.i16(os2.offset + 72);
		}
	}

	let name = tables.get("name");
	let family = name === undefined ? "" : (readName(reader, name, 16) ?? readName(reader, name, 1));
	let subfamily =
		name === undefined ? "" : (readName(reader, name, 17) ?? readName(reader, name, 2));
	let postscriptName = name === undefined ? "" : readName(reader, name, 6);

	return success(
		new Font({
			reader,
			unitsPerEm,
			ascender,
			descender,
			lineGap,
			family: family ?? "",
			subfamily: subfamily ?? "",
			postscriptName: postscriptName ?? "",
			...readMetrics(reader, head, os2, tables.get("post")),
			numGlyphs,
			numberOfHMetrics,
			hmtxOffset: hmtx.offset,
			indexToLocFormat,
			locaOffset: loca.offset,
			glyfOffset: glyf.offset,
			glyfLength: glyf.length,
			cmap: subtable,
			kernOffset: tables.get("kern")?.offset ?? null,
			gposOffset: tables.get("GPOS")?.offset ?? null,
			tables,
		}),
	);
}

/**
 * A table the required-table check already proved present.
 *
 * @param tables - The table directory.
 * @param tag - One of `REQUIRED_TABLES`.
 */
function required(tables: Map<string, TableRecord>, tag: string): TableRecord {
	return tables.get(tag) ?? { offset: 0, length: 0 };
}

/**
 * A `malformed` failure.
 *
 * @param message - What is wrong.
 * @param table - The table at fault, when one is.
 */
function malformed(message: string, table?: string): Result<Font, FontError> {
	return failure(new FontError("malformed", message, table));
}

/**
 * Decodes one name record, preferring Windows Unicode, then Unicode, then Windows symbol,
 * then Mac Roman as Latin-1, so the English name a font tool shows is the one returned.
 *
 * @param reader - The font bytes.
 * @param table - The `name` table.
 * @param nameId - `16`/`17` for the typographic family/style, `1`/`2` for the legacy ones,
 *   `6` for the PostScript name.
 * @returns The name, or `null` when the font does not record it.
 */
function readName(reader: Reader, table: TableRecord, nameId: number): string | null {
	let count = reader.u16(table.offset + 2);
	let storage = table.offset + reader.u16(table.offset + 4);
	let best: { rank: number; offset: number; length: number; wide: boolean } | null = null;
	for (let index = 0; index < count; index++) {
		let record = table.offset + 6 + index * 12;
		if (reader.u16(record + 6) !== nameId) continue;
		let platform = reader.u16(record);
		let encoding = reader.u16(record + 2);
		let language = reader.u16(record + 4);
		let rank = 0;
		if (platform === 3 && (encoding === 1 || encoding === 10)) rank = language === 0x409 ? 4 : 3;
		else if (platform === 0) rank = 2;
		else if (platform === 3 && encoding === 0) rank = 1.75;
		else if (platform === 1 && encoding === 0) rank = language === 0 ? 1.5 : 1;
		if (rank === 0 || (best !== null && best.rank >= rank)) continue;
		best = {
			rank,
			offset: storage + reader.u16(record + 10),
			length: reader.u16(record + 8),
			wide: platform !== 1,
		};
	}
	if (best === null || best.offset + best.length > table.offset + table.length) return null;

	let codes: number[] = [];
	if (best.wide) {
		for (let index = 0; index + 1 < best.length; index += 2) {
			codes.push(reader.u16(best.offset + index));
		}
	} else {
		for (let index = 0; index < best.length; index++) codes.push(reader.u8(best.offset + index));
	}
	return String.fromCharCode(...codes);
}
