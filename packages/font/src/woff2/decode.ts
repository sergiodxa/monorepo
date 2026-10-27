/**
 * WOFF2 decoding: reads the table directory (and collection directory), decompresses the
 * one Brotli stream holding every table, reverses the `glyf`, `loca` and `hmtx` transforms,
 * and lays the tables out as a plain sfnt or TrueType collection with real checksums.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { FontError } from "../font-error.js";
import { align4, MAX_SFNT_SIZE, writeOffsetTable } from "../woff.js";

import type { GlyfTables } from "./glyf.js";

import { decompressBrotli } from "./brotli.js";
import { Cursor } from "./cursor.js";
import { glyphXMins, reconstructGlyf, reconstructHmtx } from "./glyf.js";

/** The tags a directory entry names by index (`flags & 0x3f`), 63 meaning one spelled out. */
const KNOWN_TAGS = [
	"cmap",
	"head",
	"hhea",
	"hmtx",
	"maxp",
	"name",
	"OS/2",
	"post",
	"cvt ",
	"fpgm",
	"glyf",
	"loca",
	"prep",
	"CFF ",
	"VORG",
	"EBDT",
	"EBLC",
	"gasp",
	"hdmx",
	"kern",
	"LTSH",
	"PCLT",
	"VDMX",
	"vhea",
	"vmtx",
	"BASE",
	"GDEF",
	"GPOS",
	"GSUB",
	"EBSC",
	"JSTF",
	"MATH",
	"CBDT",
	"CBLC",
	"COLR",
	"CPAL",
	"SVG ",
	"sbix",
	"acnt",
	"avar",
	"bdat",
	"bloc",
	"bsln",
	"cvar",
	"fdsc",
	"feat",
	"fmtx",
	"fvar",
	"gvar",
	"hsty",
	"just",
	"lcar",
	"mort",
	"morx",
	"opbd",
	"prop",
	"trak",
	"Zapf",
	"Silf",
	"Glat",
	"Gloc",
	"Feat",
	"Sill",
];

/** `ttcf` as a 32-bit flavor. */
const COLLECTION_FLAVOR = 0x74746366;

/** The value `head.checkSumAdjustment` brings a font's whole-file checksum to. */
const CHECKSUM_MAGIC = 0xb1b0afba;

/** One table of the directory and, once decompressed, its bytes. */
interface Woff2Table {
	tag: string;
	transformed: boolean;
	/** Bytes the table takes in the decompressed stream. */
	length: number;
	data: Uint8Array;
}

/** One font of the file: its flavor and the directory entries it uses. */
interface Woff2Font {
	flavor: number;
	tables: number[];
}

/**
 * Decodes a WOFF2 file into the sfnt (or TrueType collection) it compresses.
 *
 * @param bytes - The whole `.woff2` file.
 * @returns A `.ttf`/`.otf` file's bytes, or a `.ttc` file's for a collection; or a
 *   `FontError` whose `code` is `malformed`, naming the table at fault when one is.
 * @example let sfnt = decodeWoff2(new Uint8Array(await response.arrayBuffer()));
 */
export function decodeWoff2(bytes: Uint8Array | ArrayBuffer): Result<Uint8Array, FontError> {
	let data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let header = new Cursor(data);
	if (header.tag() !== "wOF2") return malformed("The file does not start with wOF2.");
	let flavor = header.u32();
	header.u32();
	let count = header.u16();
	header.bytes(6);
	let compressedSize = header.u32();
	header.bytes(24);
	if (header.overrun || count === 0) return malformed("The WOFF2 header is truncated.");

	let tables = readDirectory(header, count);
	if (isFailure(tables)) return tables;
	let collection = flavor === COLLECTION_FLAVOR ? readCollection(header, count) : null;
	let fonts = collection?.fonts ?? null;
	if (header.overrun) return malformed("The WOFF2 directory is truncated.");
	let start = header.position;
	if (start + compressedSize > data.length) {
		return malformed("The compressed data runs past the end of the file.");
	}

	let total = tables.data.reduce((sum, table) => sum + table.length, 0);
	if (total > MAX_SFNT_SIZE) return malformed("The WOFF2 tables decode to more than 1 GiB.");
	let stream = decompressBrotli(data.subarray(start, start + compressedSize), total);
	if (isFailure(stream)) return stream;
	let offset = 0;
	for (let table of tables.data) {
		table.data = stream.data.subarray(offset, offset + table.length);
		offset += table.length;
	}

	let list = fonts ?? [{ flavor, tables: tables.data.map((_, index) => index) }];
	if (list.length === 0 || fonts?.some((font) => font.tables.length === 0)) {
		return malformed("The WOFF2 collection directory is invalid.");
	}
	for (let font of list) {
		let restored = untransform(tables.data, font);
		if (isFailure(restored)) return restored;
	}
	if (collection === null)
		return success(writeSfnt(tables.data, list[0] ?? { flavor, tables: [] }));
	return success(writeTtc(tables.data, list, collection.version));
}

/**
 * Reads the table directory.
 *
 * @param cursor - Positioned after the header.
 * @param count - `numTables`.
 */
function readDirectory(cursor: Cursor, count: number): Result<Woff2Table[], FontError> {
	let tables: Woff2Table[] = [];
	for (let index = 0; index < count; index++) {
		let flags = cursor.u8();
		let tag = (flags & 0x3f) === 63 ? cursor.tag() : (KNOWN_TAGS[flags & 0x3f] ?? "");
		let version = flags >> 6;
		let length = cursor.base128();
		let isGlyf = tag === "glyf" || tag === "loca";
		if (isGlyf && version !== 0 && version !== 3) {
			return malformed(`The ${tag} table uses unknown transform ${version}.`, tag);
		}
		let transformed = isGlyf ? version === 0 : version !== 0;
		if (transformed && !isGlyf && !(tag === "hmtx" && version === 1)) {
			return malformed(`The ${tag} table uses unknown transform ${version}.`, tag);
		}
		if (transformed) length = cursor.base128();
		if (length < 0 || cursor.overrun) return malformed("The WOFF2 table directory is invalid.");
		if (transformed && tag === "loca" && length !== 0) {
			return malformed("A transformed loca table must be empty.", "loca");
		}
		tables.push({ tag, transformed, length, data: new Uint8Array(0) });
	}
	return success(tables);
}

/**
 * Reads the collection directory: its version, and each font's flavor and table indices.
 *
 * @param cursor - Positioned after the table directory.
 * @param count - How many tables the directory holds.
 * @returns The collection; an index out of range leaves its font list empty.
 */
function readCollection(cursor: Cursor, count: number): { version: number; fonts: Woff2Font[] } {
	let version = cursor.u32() >>> 16 === 2 ? 2 : 1;
	let numFonts = cursor.u255();
	let fonts: Woff2Font[] = [];
	for (let font = 0; font < numFonts && !cursor.overrun; font++) {
		let numTables = cursor.u255();
		let flavor = cursor.u32();
		let tables: number[] = [];
		for (let index = 0; index < numTables && !cursor.overrun; index++) {
			let table = cursor.u255();
			if (table >= count) return { version, fonts: [] };
			tables.push(table);
		}
		fonts.push({ flavor, tables });
	}
	return { version, fonts };
}

/**
 * Reverses the transforms of one font's tables in place. In a collection the fonts share
 * tables, so a table already restored for an earlier font is left as it is.
 *
 * @param tables - Every table, decompressed.
 * @param font - The font.
 */
function untransform(tables: Woff2Table[], font: Woff2Font): Result<void, FontError> {
	let find = (tag: string) => font.tables.map((index) => tables[index]).find((t) => t?.tag === tag);
	let glyf = find("glyf");
	let loca = find("loca");
	let rebuilt: GlyfTables | null = null;
	if (glyf?.transformed) {
		if (loca === undefined || !loca.transformed) {
			return malformed("A transformed glyf table needs a transformed loca.", "loca");
		}
		let result = reconstructGlyf(glyf.data);
		if (isFailure(result)) return result;
		rebuilt = result.data;
		glyf.data = rebuilt.glyf;
		glyf.transformed = false;
		loca.data = rebuilt.loca;
		loca.transformed = false;
	} else if (loca?.transformed) {
		return malformed("A transformed loca table needs a transformed glyf.", "loca");
	}

	let hmtx = find("hmtx");
	if (!hmtx?.transformed) return success(undefined);
	let maxp = find("maxp")?.data;
	let hhea = find("hhea")?.data;
	let head = find("head")?.data;
	if (maxp === undefined || hhea === undefined || head === undefined || glyf === undefined) {
		return malformed("A transformed hmtx table needs glyf, head, hhea and maxp.", "hmtx");
	}
	let numGlyphs = u16(maxp, 4);
	let indexFormat = u16(head, 50);
	let xMins =
		rebuilt?.xMins ??
		glyphXMins(glyf.data, loca?.data ?? new Uint8Array(0), indexFormat, numGlyphs);
	let result = reconstructHmtx(hmtx.data, numGlyphs, u16(hhea, 34), xMins);
	if (isFailure(result)) return result;
	hmtx.data = result.data;
	hmtx.transformed = false;
	return success(undefined);
}

/**
 * Lays out one font as an sfnt, tables sorted by tag, with checksums and
 * `head.checkSumAdjustment` recomputed.
 *
 * @param tables - Every table, restored.
 * @param font - The font.
 */
function writeSfnt(tables: Woff2Table[], font: Woff2Font): Uint8Array {
	let entries = sortedEntries(tables, font);
	let size = 12 + entries.length * 16;
	for (let index of entries) size += align4(tables[index]?.data.length ?? 0);
	let output = new Uint8Array(size);
	let view = new DataView(output.buffer);
	let offsets = new Map<number, number>();
	let position = 12 + entries.length * 16;
	for (let index of entries) {
		let data = tables[index]?.data ?? new Uint8Array(0);
		offsets.set(index, position);
		output.set(data, position);
		position += align4(data.length);
	}
	let head = writeDirectory(view, 0, tables, font, entries, offsets);
	if (head !== null && (tables[head.index]?.data.length ?? 0) >= 12) {
		view.setUint32(head.offset + 8, 0);
		let sum = checksum(output, 0, output.length);
		view.setUint32(head.offset + 8, (CHECKSUM_MAGIC - sum) >>> 0);
	}
	return output;
}

/**
 * Lays out a TrueType collection: the `ttcf` header, each font's directory, then each
 * table once, shared by every font that lists it.
 *
 * @param tables - Every table, restored.
 * @param fonts - The fonts.
 * @param version - The collection header's major version.
 */
function writeTtc(tables: Woff2Table[], fonts: Woff2Font[], version: number): Uint8Array {
	let headerSize = 12 + fonts.length * 4 + (version === 2 ? 12 : 0);
	let sorted = fonts.map((font) => sortedEntries(tables, font));
	let size = headerSize + sorted.reduce((sum, entries) => sum + 12 + entries.length * 16, 0);
	let used = [...new Set(sorted.flat())].sort((a, b) => a - b);
	for (let index of used) size += align4(tables[index]?.data.length ?? 0);
	let output = new Uint8Array(size);
	let view = new DataView(output.buffer);
	view.setUint32(0, COLLECTION_FLAVOR);
	view.setUint16(4, version);
	view.setUint32(8, fonts.length);
	let position =
		size - used.reduce((sum, index) => sum + align4(tables[index]?.data.length ?? 0), 0);
	let offsets = new Map<number, number>();
	for (let index of used) {
		let data = tables[index]?.data ?? new Uint8Array(0);
		offsets.set(index, position);
		output.set(data, position);
		position += align4(data.length);
	}
	let directory = headerSize;
	for (let [font, entries] of sorted.entries()) {
		view.setUint32(12 + font * 4, directory);
		writeDirectory(
			view,
			directory,
			tables,
			fonts[font] ?? { flavor: 0, tables: [] },
			entries,
			offsets,
		);
		directory += 12 + entries.length * 16;
	}
	return output;
}

/**
 * Writes one font's offset table and table records.
 *
 * @param view - The output.
 * @param at - Where the offset table goes.
 * @param tables - Every table.
 * @param font - The font.
 * @param entries - Its table indices, sorted by tag.
 * @param offsets - Where each table's data was written.
 * @returns Where the font's `head` table is, `null` without one.
 */
function writeDirectory(
	view: DataView,
	at: number,
	tables: Woff2Table[],
	font: Woff2Font,
	entries: number[],
	offsets: Map<number, number>,
): { index: number; offset: number } | null {
	let output = new Uint8Array(view.buffer);
	let directory = new DataView(view.buffer, at);
	writeOffsetTable(directory, font.flavor, entries.length);
	let head: { index: number; offset: number } | null = null;
	for (let [position, index] of entries.entries()) {
		let table = tables[index];
		let offset = offsets.get(index) ?? 0;
		let record = at + 12 + position * 16;
		let tag = table?.tag ?? "    ";
		for (let char = 0; char < 4; char++) view.setUint8(record + char, tag.charCodeAt(char));
		let length = table?.data.length ?? 0;
		view.setUint32(record + 4, checksum(output, offset, length, tag === "head"));
		view.setUint32(record + 8, offset);
		view.setUint32(record + 12, length);
		if (tag === "head") head = { index, offset };
	}
	return head;
}

/**
 * A font's table indices sorted by tag, the order an sfnt directory requires.
 *
 * @param tables - Every table.
 * @param font - The font.
 */
function sortedEntries(tables: Woff2Table[], font: Woff2Font): number[] {
	return [...font.tables].sort((a, b) => {
		let left = tables[a]?.tag ?? "";
		let right = tables[b]?.tag ?? "";
		if (left === right) return 0;
		return left < right ? -1 : 1;
	});
}

/**
 * The sfnt checksum of a byte range: its big-endian 32-bit words summed, zero padded.
 *
 * @param bytes - The output.
 * @param offset - Where the range starts, 4-byte aligned.
 * @param length - Its length.
 * @param skipAdjustment - Treats bytes 8–11 as zero, as `head`'s checksum requires.
 */
function checksum(
	bytes: Uint8Array,
	offset: number,
	length: number,
	skipAdjustment = false,
): number {
	let sum = 0;
	for (let index = 0; index < length; index += 4) {
		if (skipAdjustment && index === 8) continue;
		let word =
			(bytes[offset + index] ?? 0) * 0x1000000 +
			((index + 1 < length ? (bytes[offset + index + 1] ?? 0) : 0) << 16) +
			((index + 2 < length ? (bytes[offset + index + 2] ?? 0) : 0) << 8) +
			(index + 3 < length ? (bytes[offset + index + 3] ?? 0) : 0);
		sum = (sum + word) >>> 0;
	}
	return sum;
}

/**
 * A big-endian 16-bit field of a table.
 *
 * @param bytes - The table.
 * @param offset - The field's offset.
 */
function u16(bytes: Uint8Array, offset: number): number {
	return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
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
