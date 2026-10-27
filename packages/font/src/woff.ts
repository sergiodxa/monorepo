/**
 * WOFF 1.0 decoding: inflates each table and lays the tables out again as a plain sfnt, so
 * a web font opens through the same table reader as a `.ttf` or `.otf`. Checksums are copied
 * through as stored; sizes are checked, since every later read trusts them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Reader } from "./reader.js";

import { FontError } from "./font-error.js";
import { inflate } from "./inflate.js";

/** Size of the WOFF header. */
const HEADER_SIZE = 44;

/** Size of one WOFF table directory entry. */
const ENTRY_SIZE = 20;

/**
 * The most a DEFLATE stream can expand: 258 bytes from a match of under two bits, so a table
 * claiming more than this ratio is corrupt and its size is never allocated.
 */
const MAX_DEFLATE_RATIO = 1032;

/** The largest sfnt a container may decode to; a bigger claim is corrupt, never allocated. */
export const MAX_SFNT_SIZE = 2 ** 30;

/** One table as the WOFF directory describes it. */
interface WoffTable {
	tag: string;
	offset: number;
	compressedLength: number;
	length: number;
	checksum: number;
}

/**
 * Decodes a WOFF file into the sfnt it wraps.
 *
 * @param reader - The whole WOFF file, starting with `wOFF`.
 * @returns The sfnt bytes, with tables in directory order and 4-byte aligned, or a
 *   `malformed` `FontError` naming the table at fault when one is.
 */
export function decodeWoff(reader: Reader): Result<Uint8Array, FontError> {
	if (reader.length < HEADER_SIZE) return malformed("The WOFF header is truncated.");
	let flavor = reader.u32(4);
	let count = reader.u16(12);
	if (count === 0) return malformed("The WOFF file has no tables.");
	if (HEADER_SIZE + count * ENTRY_SIZE > reader.length) {
		return malformed("The WOFF table directory is truncated.");
	}

	let tables: WoffTable[] = [];
	let size = 12 + count * 16;
	for (let index = 0; index < count; index++) {
		let entry = HEADER_SIZE + index * ENTRY_SIZE;
		let table: WoffTable = {
			tag: reader.tag(entry),
			offset: reader.u32(entry + 4),
			compressedLength: reader.u32(entry + 8),
			length: reader.u32(entry + 12),
			checksum: reader.u32(entry + 16),
		};
		if (table.offset + table.compressedLength > reader.length) {
			return malformed(`The ${table.tag} table extends past the end of the file.`, table.tag);
		}
		if (
			table.compressedLength > table.length ||
			table.length > table.compressedLength * MAX_DEFLATE_RATIO + 64
		) {
			return malformed(`The ${table.tag} table's sizes are inconsistent.`, table.tag);
		}
		tables.push(table);
		size += align4(table.length);
	}

	if (size > MAX_SFNT_SIZE) return malformed("The WOFF tables decode to more than 1 GiB.");
	let output = new Uint8Array(size);
	let view = new DataView(output.buffer);
	writeOffsetTable(view, flavor, count);
	let position = 12 + count * 16;
	for (let [index, table] of tables.entries()) {
		let data = reader.bytes(table.offset, table.compressedLength);
		if (table.compressedLength < table.length) {
			let inflated = inflate(data, table.length);
			if (isFailure(inflated)) {
				return malformed(`The ${table.tag} table: ${inflated.error.message}`, table.tag);
			}
			data = inflated.data;
		}
		output.set(data, position);
		let record = 12 + index * 16;
		for (let char = 0; char < 4; char++) {
			view.setUint8(record + char, table.tag.charCodeAt(char));
		}
		view.setUint32(record + 4, table.checksum);
		view.setUint32(record + 8, position);
		view.setUint32(record + 12, table.length);
		position += align4(table.length);
	}
	return success(output);
}

/**
 * Writes an sfnt offset table: the version and the binary-search fields a table directory
 * of `count` entries carries.
 *
 * @param view - The output, at offset 0.
 * @param flavor - The sfnt version.
 * @param count - How many tables.
 */
export function writeOffsetTable(view: DataView, flavor: number, count: number): void {
	let power = 1;
	let log = 0;
	while (power * 2 <= count) {
		power *= 2;
		log++;
	}
	view.setUint32(0, flavor);
	view.setUint16(4, count);
	view.setUint16(6, power * 16);
	view.setUint16(8, log);
	view.setUint16(10, count * 16 - power * 16);
}

/**
 * Rounds a length up to the 4-byte boundary sfnt tables start on.
 *
 * @param length - A byte length.
 */
export function align4(length: number): number {
	return Math.ceil(length / 4) * 4;
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
