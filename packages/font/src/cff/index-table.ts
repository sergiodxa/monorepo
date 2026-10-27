/**
 * The INDEX structure of CFF and CFF2: a count, an offset size and `count + 1` offsets into
 * a data block. Every offset is checked against the table's end when the INDEX is read, so
 * a caller slices items without further bounds checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Reader } from "../reader.js";

import { FontError } from "../font-error.js";

/**
 * A parsed INDEX. `offsets` holds `count + 1` absolute file offsets, so item `i` spans
 * `offsets[i]` to `offsets[i + 1]`; `end` is the first byte after the INDEX.
 */
export interface CffIndex {
	/** Absolute offset of the INDEX's count field. */
	readonly start: number;
	/** Absolute offset of the first byte after the INDEX. */
	readonly end: number;
	readonly count: number;
	/** Byte size of each stored offset, `0` for an empty INDEX. */
	readonly offSize: number;
	readonly offsets: Uint32Array;
}

/** A slice of the file one INDEX item occupies. */
export interface CffItem {
	offset: number;
	length: number;
}

/**
 * Reads an unsigned big-endian integer of 1 to 4 bytes, the width INDEX offsets and CFF
 * header offsets are stored in.
 *
 * @param reader - The whole file.
 * @param offset - Absolute byte offset.
 * @param size - Width in bytes.
 */
export function readOffset(reader: Reader, offset: number, size: number): number {
	let value = 0;
	for (let index = 0; index < size; index++) value = value * 256 + reader.u8(offset + index);
	return value;
}

/**
 * Reads the INDEX at `offset`. CFF2 stores the count in 32 bits, CFF in 16; an offset size
 * outside 1–4, offsets that decrease, or data reaching past `limit` make it `malformed`.
 *
 * @param reader - The whole file.
 * @param offset - Absolute offset of the INDEX.
 * @param limit - Absolute end of the table the INDEX lives in.
 * @param cff2 - Whether the count is 32-bit.
 * @param tag - The table tag errors name.
 */
export function readIndex(
	reader: Reader,
	offset: number,
	limit: number,
	cff2: boolean,
	tag: string,
): Result<CffIndex, FontError> {
	let countSize = cff2 ? 4 : 2;
	if (offset < 0 || offset + countSize > limit) return malformed("An INDEX is truncated.", tag);
	let count = cff2 ? reader.u32(offset) : reader.u16(offset);
	if (count === 0) {
		return success({
			start: offset,
			end: offset + countSize,
			count: 0,
			offSize: 0,
			offsets: new Uint32Array([offset + countSize]),
		});
	}
	let offSize = reader.u8(offset + countSize);
	if (offSize < 1 || offSize > 4) return malformed("An INDEX has an invalid offset size.", tag);
	let array = offset + countSize + 1;
	if (array + (count + 1) * offSize > limit) return malformed("An INDEX is truncated.", tag);

	let base = array + (count + 1) * offSize - 1;
	let offsets = new Uint32Array(count + 1);
	let previous = 1;
	for (let index = 0; index <= count; index++) {
		let relative = readOffset(reader, array + index * offSize, offSize);
		if (relative < previous || (index === 0 && relative !== 1)) {
			return malformed("An INDEX has offsets out of order.", tag);
		}
		previous = relative;
		offsets[index] = base + relative;
	}
	let end = offsets[count] ?? base;
	if (end > limit) return malformed("An INDEX reaches past the end of its table.", tag);
	return success({ start: offset, end, count, offSize, offsets });
}

/**
 * Item `index` of an INDEX, `null` past its count.
 *
 * @param table - The INDEX.
 * @param index - Item number.
 */
export function indexItem(table: CffIndex, index: number): CffItem | null {
	if (!Number.isInteger(index) || index < 0 || index >= table.count) return null;
	let start = table.offsets[index] ?? 0;
	let end = table.offsets[index + 1] ?? start;
	return { offset: start, length: end - start };
}

/**
 * A `malformed` failure for the table at fault.
 *
 * @param message - What is wrong.
 * @param tag - `CFF ` or `CFF2`.
 */
export function malformed<T>(message: string, tag: string): Result<T, FontError> {
	return failure(new FontError("malformed", message, tag));
}
