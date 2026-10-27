/**
 * The DICT structure of CFF and CFF2: operands followed by an operator, read into a map from
 * operator to operands in file order, so the Top, Font and Private DICTs share one parser and
 * a writer can serialize the entries back in the order they were found.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { FontError } from "../font-error.js";
import type { Reader } from "../reader.js";

import { malformed } from "./index-table.js";

/**
 * A DICT's entries: operator to operands. A two-byte operator `12 x` is stored as
 * `1200 + x`, so `ROS` (`12 30`) is key `1230`.
 */
export type CffDict = Map<number, number[]>;

/** Operator keys this package reads; two-byte operators are `1200 + second byte`. */
export const DICT_OP = {
	charset: 15,
	encoding: 16,
	charStrings: 17,
	private: 18,
	subrs: 19,
	defaultWidthX: 20,
	nominalWidthX: 21,
	vsindex: 22,
	blend: 23,
	vstore: 24,
	maxstack: 25,
	charstringType: 1206,
	ros: 1230,
	cidCount: 1234,
	fdArray: 1236,
	fdSelect: 1237,
} as const;

/** The most operands any DICT entry may carry: CFF2's maximum stack depth. */
const MAX_OPERANDS = 513;

/** The characters of the nibbles a real number operand is written in, `e`/`e-` as written. */
const REAL_NIBBLES = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "e", "e-", "", "-"];

/**
 * Reads the DICT in `start..end`. A CFF2 `blend` keeps the default-instance values and drops
 * their deltas, which needs `regions(vsindex)` to know how many deltas each value has; an
 * operand stack deeper than CFF2 allows, or an unknown operand byte, is `malformed`.
 *
 * @param reader - The whole file.
 * @param start - Absolute offset of the first byte.
 * @param end - Absolute offset after the last byte.
 * @param tag - The table tag errors name.
 * @param regions - The region count of an ItemVariationStore subtable, for CFF2 `blend`.
 */
export function readDict(
	reader: Reader,
	start: number,
	end: number,
	tag: string,
	regions?: (vsindex: number) => number,
): Result<CffDict, FontError> {
	let dict: CffDict = new Map();
	let operands: number[] = [];
	let position = start;
	let vsindex = 0;
	while (position < end) {
		let byte = reader.u8(position);
		if (byte <= 27) {
			let operator = byte;
			position++;
			if (byte === 12) {
				operator = 1200 + reader.u8(position);
				position++;
			}
			if (operator === DICT_OP.blend) {
				let blended = blendOperands(operands, regions?.(vsindex) ?? 0);
				if (blended === null) return malformed("A DICT blend has too few operands.", tag);
				operands = blended;
				continue;
			}
			if (operator === DICT_OP.vsindex) vsindex = operands[0] ?? 0;
			dict.set(operator, operands);
			operands = [];
			continue;
		}
		let operand = readOperand(reader, position, end);
		if (operand === null) return malformed("A DICT has an invalid operand.", tag);
		operands.push(operand.value);
		if (operands.length > MAX_OPERANDS) return malformed("A DICT has too many operands.", tag);
		position = operand.next;
	}
	return success(dict);
}

/**
 * Applies a DICT `blend` at the default instance: of `n` values and their `n * regions`
 * deltas, the `n` values stay on the stack.
 *
 * @param operands - The stack, ending in the value count.
 * @param regions - Regions per value.
 * @returns The new stack, or `null` when it holds fewer operands than the blend names.
 */
function blendOperands(operands: number[], regions: number): number[] | null {
	let count = operands.at(-1);
	if (count === undefined || !Number.isInteger(count) || count < 0) return null;
	let base = operands.length - 1 - count * (regions + 1);
	if (base < 0) return null;
	return operands.slice(0, base + count);
}

/**
 * Reads one DICT operand: integers in 1, 2, 3 or 5 bytes, or a nibble-coded real.
 *
 * @param reader - The whole file.
 * @param position - Offset of the operand's first byte.
 * @param end - The DICT's end, past which a real stops.
 * @returns The value and the offset after it, or `null` for a reserved byte.
 */
function readOperand(
	reader: Reader,
	position: number,
	end: number,
): { value: number; next: number } | null {
	let byte = reader.u8(position);
	if (byte >= 32 && byte <= 246) return { value: byte - 139, next: position + 1 };
	if (byte >= 247 && byte <= 250) {
		return { value: (byte - 247) * 256 + reader.u8(position + 1) + 108, next: position + 2 };
	}
	if (byte >= 251 && byte <= 254) {
		return { value: -(byte - 251) * 256 - reader.u8(position + 1) - 108, next: position + 2 };
	}
	if (byte === 28) return { value: reader.i16(position + 1), next: position + 3 };
	if (byte === 29) return { value: reader.u32(position + 1) | 0, next: position + 5 };
	if (byte === 30) return readReal(reader, position + 1, end);
	return null;
}

/**
 * Reads a real operand's nibbles up to the `0xf` terminator or the DICT's end.
 *
 * @param reader - The whole file.
 * @param position - Offset of the first nibble byte.
 * @param end - The DICT's end.
 */
function readReal(reader: Reader, position: number, end: number): { value: number; next: number } {
	let text = "";
	let next = position;
	while (next < end) {
		let byte = reader.u8(next);
		next++;
		let high = byte >> 4;
		if (high === 15) break;
		text += REAL_NIBBLES[high] ?? "";
		let low = byte & 15;
		if (low === 15) break;
		text += REAL_NIBBLES[low] ?? "";
	}
	let value = Number.parseFloat(text);
	return { value: Number.isFinite(value) ? value : 0, next };
}
