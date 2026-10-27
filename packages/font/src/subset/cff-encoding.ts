/**
 * Serializes the CFF structures a subset writes: DICT entries with their operands in the
 * shortest form (offsets in a fixed five bytes, so a DICT's size is known before the offsets
 * it holds), INDEXes with the smallest offset size, and the String INDEX a subset builds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CffDict } from "../cff/index.js";

import { STANDARD_STRINGS } from "../cff/standard.data.js";

/** One DICT entry to write: an operator key (`1200 + x` for `12 x`) and its operands. */
export interface DictEntry {
	op: number;
	operands: readonly number[];
	/** Write every operand as a five-byte integer, the form offsets take. */
	fixed?: boolean;
}

/** Nibble of each character a real operand is written with; `e-` is matched before `e`. */
const REAL_NIBBLES: Readonly<Record<string, number>> = {
	".": 0xa,
	e: 0xb,
	"-": 0xe,
};

/** Values a DICT operator takes when it is absent; an entry equal to its default is dropped. */
const DICT_DEFAULTS: ReadonlyMap<number, readonly number[]> = new Map([
	[1201, [0]],
	[1202, [0]],
	[1203, [-100]],
	[1204, [50]],
	[1205, [0]],
	[1206, [2]],
	[1207, [0.001, 0, 0, 0.001, 0, 0]],
	[1208, [0]],
	[5, [0, 0, 0, 0]],
	[1231, [0]],
	[1232, [0]],
	[1233, [0]],
	[1209, [0.039625]],
	[1210, [7]],
	[1211, [1]],
	[1214, [0]],
	[1217, [0]],
	[1218, [0.06]],
	[1219, [0]],
	[20, [0]],
	[21, [0]],
]);

/**
 * Whether an entry holds exactly its operator's default, element by element, so `-0` and `0`
 * match while an array of another length is kept.
 *
 * @param op - Operator key.
 * @param operands - The entry's operands.
 */
export function isDefault(op: number, operands: readonly number[]): boolean {
	let fallback = DICT_DEFAULTS.get(op);
	if (fallback === undefined || fallback.length !== operands.length) return false;
	return operands.every((value, index) => value === fallback[index]);
}

/**
 * The entries of a source DICT in file order without `drop`'s operators and without those
 * equal to their default.
 *
 * @param dict - A parsed DICT.
 * @param drop - Operators the caller rewrites or omits.
 */
export function keptEntries(dict: CffDict, drop: ReadonlySet<number>): DictEntry[] {
	let entries: DictEntry[] = [];
	for (let [op, operands] of dict) {
		if (drop.has(op) || isDefault(op, operands)) continue;
		entries.push({ op, operands });
	}
	return entries;
}

/**
 * A DICT's bytes: each entry's operands, then its operator.
 *
 * @param entries - Entries in the order to write them.
 */
export function encodeDict(entries: readonly DictEntry[]): Uint8Array {
	let bytes: number[] = [];
	for (let { op, operands, fixed } of entries) {
		for (let value of operands) {
			bytes.push(...(fixed === true ? fixedInteger(value) : dictOperand(value)));
		}
		if (op >= 1200) bytes.push(12, op - 1200);
		else bytes.push(op);
	}
	return Uint8Array.from(bytes);
}

/**
 * A DICT operand: an integer in the shortest of its 1, 2, 3 and 5-byte forms, any other
 * number as a nibble-coded real.
 *
 * @param value - The operand.
 */
export function dictOperand(value: number): number[] {
	if (!Number.isInteger(value)) return realOperand(value);
	if (value >= -107 && value <= 107) return [value + 139];
	if (value >= 108 && value <= 1131) {
		let rest = value - 108;
		return [(rest >> 8) + 247, rest & 0xff];
	}
	if (value >= -1131 && value <= -108) {
		let rest = -value - 108;
		return [(rest >> 8) + 251, rest & 0xff];
	}
	if (value >= -32768 && value <= 32767) return [28, (value >> 8) & 0xff, value & 0xff];
	if (value >= -0x80000000 && value <= 0x7fffffff) return fixedInteger(value);
	return realOperand(value);
}

/**
 * An integer in the five-byte form, which every offset is written with.
 *
 * @param value - A 32-bit integer.
 */
function fixedInteger(value: number): number[] {
	let word = value | 0;
	return [29, (word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff];
}

/**
 * A real operand: its shortest decimal text, a nibble per character, ended by `0xf`.
 *
 * @param value - A finite number; anything else writes `0`.
 */
function realOperand(value: number): number[] {
	let text = Number.isFinite(value) ? String(value).replace("e+", "e") : "0";
	let nibbles: number[] = [];
	for (let index = 0; index < text.length; index++) {
		let char = text[index] ?? "";
		if (char === "e" && text[index + 1] === "-") {
			nibbles.push(0xc);
			index++;
			continue;
		}
		nibbles.push(REAL_NIBBLES[char] ?? Number(char));
	}
	nibbles.push(0xf);
	if (nibbles.length % 2 === 1) nibbles.push(0xf);
	let bytes = [30];
	for (let index = 0; index < nibbles.length; index += 2) {
		bytes.push(((nibbles[index] ?? 0xf) << 4) | (nibbles[index + 1] ?? 0xf));
	}
	return bytes;
}

/**
 * A CFF (version 1) INDEX of `items`, with the smallest offset size that addresses its data.
 *
 * @param items - Item bytes in order.
 */
export function encodeIndex(items: readonly Uint8Array[]): Uint8Array {
	if (items.length === 0) return new Uint8Array(2);
	let dataSize = items.reduce((total, item) => total + item.length, 0);
	let offSize = offsetSize(dataSize + 1);
	let header = 3 + (items.length + 1) * offSize;
	let bytes = new Uint8Array(header + dataSize);
	bytes[0] = (items.length >> 8) & 0xff;
	bytes[1] = items.length & 0xff;
	bytes[2] = offSize;
	let relative = 1;
	let position = header;
	for (let index = 0; index <= items.length; index++) {
		writeOffset(bytes, 3 + index * offSize, offSize, relative);
		let item = items[index];
		if (item === undefined) break;
		bytes.set(item, position);
		position += item.length;
		relative += item.length;
	}
	return bytes;
}

/**
 * Bytes needed to store `value` as an unsigned offset.
 *
 * @param value - The largest offset to store.
 */
function offsetSize(value: number): number {
	if (value < 0x100) return 1;
	if (value < 0x10000) return 2;
	if (value < 0x1000000) return 3;
	return 4;
}

/**
 * Writes an unsigned big-endian integer of `size` bytes.
 *
 * @param bytes - Destination.
 * @param at - Offset of the first byte.
 * @param size - Width in bytes.
 * @param value - The value.
 */
function writeOffset(bytes: Uint8Array, at: number, size: number, value: number): void {
	for (let index = size - 1; index >= 0; index--) {
		bytes[at + size - 1 - index] = Math.floor(value / 256 ** index) & 0xff;
	}
}

/**
 * The String INDEX a subset writes: standard strings resolve to their fixed SIDs, any other
 * string is stored once, in the order first asked for.
 */
export class StringTable {
	#strings: string[] = [];
	#ids = new Map<string, number>();

	/**
	 * The SID of `text` in the subset, adding it to the String INDEX when it is not standard.
	 *
	 * @param text - The string.
	 */
	add(text: string): number {
		let found = this.#ids.get(text);
		if (found !== undefined) return found;
		let standard = STANDARD_STRINGS.indexOf(text);
		let sid = standard >= 0 ? standard : STANDARD_STRINGS.length + this.#strings.length;
		if (standard < 0) this.#strings.push(text);
		this.#ids.set(text, sid);
		return sid;
	}

	/** The String INDEX, each string stored as single-byte characters. */
	encode(): Uint8Array {
		return encodeIndex(
			this.#strings.map((text) => Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff)),
		);
	}
}
