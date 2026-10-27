/**
 * Opens one sfnt font (TrueType or CFF outlines) at an offset in a file. It reads the table
 * directory and fixed-size headers, checks every size later lookups rely on, and leaves glyph
 * data, cmap subtables and kerning on the bytes, so opening a font is a handful of reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { FontData, TableRecord } from "./font.js";
import type { Reader } from "./reader.js";

import { openCff } from "./cff/index.js";
import { selectCharacterMap } from "./cmap.js";
import { FontError } from "./font-error.js";
import { Font } from "./font.js";
import { readMetrics } from "./metrics.js";
import { pickName, readNames } from "./names.js";

/** Tables every font this package reads carries, whatever its outlines. */
const REQUIRED_TABLES = ["head", "hhea", "maxp", "hmtx", "cmap"] as const;

/** The sfnt versions of a TrueType-outline font (`0x00010000`, Apple's `true`) and a CFF one. */
const TRUETYPE_VERSION = 0x00010000;

/** `head.magicNumber`, which tells a real `head` table from bytes at the wrong offset. */
const HEAD_MAGIC = 0x5f0f3cf5;

/** `OS/2.fsSelection` bit telling layout to use the typographic metrics over `hhea`'s. */
const USE_TYPO_METRICS = 0x0080;

/**
 * Reads the sfnt whose offset table starts at `offset`; table offsets are absolute in the
 * file, which is how a collection shares tables between its fonts.
 *
 * @param reader - The whole file.
 * @param offset - Where this font's offset table starts, `0` for a single font.
 * @returns The font, or a `FontError` whose `code` is `unsupported`, `missing-table` or
 *   `malformed`.
 */
export function openSfnt(reader: Reader, offset: number): Result<Font, FontError> {
	let version = reader.tag(offset);
	if (reader.u32(offset) !== TRUETYPE_VERSION && version !== "true" && version !== "OTTO") {
		return malformed("The file does not start with a TrueType or OpenType signature.");
	}

	let count = reader.u16(offset + 4);
	if (offset + 12 + count * 16 > reader.length) {
		return malformed("The table directory is truncated.");
	}
	let tables = new Map<string, TableRecord>();
	for (let index = 0; index < count; index++) {
		let record = offset + 12 + index * 16;
		let tag = reader.tag(record);
		let start = reader.u32(record + 8);
		let length = reader.u32(record + 12);
		if (start + length > reader.length) {
			return malformed(`The ${tag} table extends past the end of the file.`, tag);
		}
		tables.set(tag, { offset: start, length });
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
	let outlines = locateOutlines(reader, tables, numGlyphs, indexToLocFormat);
	if (isFailure(outlines)) return outlines;

	let characterMap = selectCharacterMap(reader, cmap.offset, cmap.length);
	if (characterMap === null) {
		return failure(
			new FontError(
				"unsupported",
				"The cmap table has no Unicode, symbol or single-byte legacy subtable.",
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

	let names = readNames(reader, tables.get("name"));
	let family = pickName(names, 16) ?? pickName(names, 1);
	let subfamily = pickName(names, 17) ?? pickName(names, 2);
	let postscriptName = pickName(names, 6);

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
			...outlines.data,
			cmap: characterMap,
			names,
			kernOffset: tables.get("kern")?.offset ?? null,
			gposOffset: tables.get("GPOS")?.offset ?? null,
			tables,
		}),
	);
}

/** Where a font's outlines live: `glyf` through `loca`, or a CFF/CFF2 table. */
type Outlines = Pick<FontData, "locaOffset" | "glyfOffset" | "glyfLength" | "cff">;

/**
 * Finds the outline tables: `glyf` and `loca` when both are present, a `CFF ` or `CFF2` table
 * otherwise. A font with neither has nothing to draw and is rejected.
 *
 * @param reader - The whole file.
 * @param tables - The table directory.
 * @param numGlyphs - From `maxp`.
 * @param indexToLocFormat - From `head`, already checked to be 0 or 1.
 */
function locateOutlines(
	reader: Reader,
	tables: Map<string, TableRecord>,
	numGlyphs: number,
	indexToLocFormat: number,
): Result<Outlines, FontError> {
	let loca = tables.get("loca");
	let glyf = tables.get("glyf");
	if (loca !== undefined && glyf !== undefined) {
		if (loca.length < (numGlyphs + 1) * (indexToLocFormat === 0 ? 2 : 4)) {
			return failure(
				new FontError("malformed", "The loca table is shorter than maxp declares.", "loca"),
			);
		}
		return success({
			locaOffset: loca.offset,
			glyfOffset: glyf.offset,
			glyfLength: glyf.length,
			cff: null,
		});
	}
	if (!tables.has("CFF ") && !tables.has("CFF2")) {
		let missing = glyf === undefined ? "glyf" : "loca";
		return failure(new FontError("missing-table", `The font has no ${missing} table.`, missing));
	}
	let cff = openCff(reader, tables, numGlyphs);
	if (isFailure(cff)) return cff;
	return success({ locaOffset: 0, glyfOffset: 0, glyfLength: 0, cff: cff.data });
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
function malformed(message: string, table?: string): Result<never, FontError> {
	return failure(new FontError("malformed", message, table));
}
