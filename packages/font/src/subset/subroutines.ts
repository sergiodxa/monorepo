/**
 * Finds which subroutines a set of CFF glyphs calls, and the glyphs their `seac` accents
 * compose, by walking each charstring's operators without drawing. A subset keeps those
 * subroutines and empties the rest, which keeps every subroutine number valid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CffIndex, CffTable } from "../cff/index.js";
import type { Reader } from "../reader.js";

import { subroutineBias } from "../cff/charstring.js";
import { indexItem } from "../cff/index.js";

/** What a set of glyphs reaches. */
export interface SubroutineUse {
	/** Global subroutine indexes (bias applied) the glyphs call. */
	global: Set<number>;
	/** Local subroutine indexes called, by Font DICT index. */
	local: Map<number, Set<number>>;
	/** Standard encoding codes `seac` accented glyphs compose from. */
	seacCodes: Set<number>;
	/**
	 * Whether some charstring computes or stores values (an arithmetic or storage operator),
	 * which a walk that does not evaluate them cannot follow; the subset keeps every subroutine.
	 */
	dynamic: boolean;
}

/** Deepest subroutine nesting the Type 2 format allows. */
const MAX_CALL_DEPTH = 10;

/** Operators one glyph's walk may pass, subroutines included, before it stops. */
const MAX_OPERATIONS = 100_000;

/** Two-byte operators that draw (the flex family) or do nothing (`dotsection`). */
const PATH_ESCAPES = new Set([0, 34, 35, 36, 37]);

/** A position inside one charstring or subroutine. */
interface Frame {
	position: number;
	end: number;
}

/**
 * Walks the charstrings of `glyphs` and collects the subroutines they call.
 *
 * @param reader - The whole file.
 * @param table - The parsed `CFF ` table.
 * @param glyphs - Original glyph ids.
 */
export function subroutineUse(
	reader: Reader,
	table: CffTable,
	glyphs: Iterable<number>,
): SubroutineUse {
	let use: SubroutineUse = {
		global: new Set(),
		local: new Map(),
		seacCodes: new Set(),
		dynamic: false,
	};
	for (let glyph of glyphs) {
		let item = indexItem(table.charStrings, glyph);
		if (item === null) continue;
		let fd = table.fdSelect?.fds[glyph] ?? 0;
		let walk = new Walk(reader, table, fd, use);
		walk.run({ position: item.offset, end: item.offset + item.length }, 0);
	}
	return use;
}

/**
 * One glyph's walk: the operand stack, the stem count `hintmask` needs to skip its mask
 * bytes, and the subroutines reached.
 */
class Walk {
	#reader: Reader;
	#table: CffTable;
	#fd: number;
	#local: CffIndex | null;
	#use: SubroutineUse;
	#stack: number[] = [];
	#stems = 0;
	#operations = 0;
	#ended = false;

	/**
	 * @param reader - The whole file.
	 * @param table - The parsed table.
	 * @param fd - The glyph's Font DICT, which holds its local subroutines.
	 * @param use - Where reached subroutines are recorded.
	 */
	constructor(reader: Reader, table: CffTable, fd: number, use: SubroutineUse) {
		this.#reader = reader;
		this.#table = table;
		this.#fd = fd;
		this.#local = table.fontDicts[fd]?.private.subrs ?? null;
		this.#use = use;
	}

	/**
	 * Walks one charstring or subroutine to its end, `return` or `endchar`.
	 *
	 * @param frame - Where its bytes are.
	 * @param depth - How many calls deep it runs.
	 */
	run(frame: Frame, depth: number): void {
		let reader = this.#reader;
		while (frame.position < frame.end && !this.#ended) {
			let byte = reader.u8(frame.position);
			frame.position++;
			if (byte >= 32 || byte === 28) {
				this.#stack.push(this.#number(byte, frame));
				continue;
			}
			this.#operations++;
			if (this.#operations > MAX_OPERATIONS) {
				this.#ended = true;
				return;
			}
			if (byte === 10 || byte === 29) {
				this.#call(byte === 29, depth);
				continue;
			}
			if (byte === 11) return;
			if (byte === 12) {
				let escape = reader.u8(frame.position);
				frame.position++;
				this.#escape(escape);
				continue;
			}
			this.#operator(byte, frame);
		}
	}

	/**
	 * Reads an operand whose first byte is `byte`, positioned after it.
	 *
	 * @param byte - The first byte.
	 * @param frame - The running frame.
	 */
	#number(byte: number, frame: Frame): number {
		let reader = this.#reader;
		if (byte === 28) {
			frame.position += 2;
			return reader.i16(frame.position - 2);
		}
		if (byte <= 246) return byte - 139;
		if (byte === 255) {
			frame.position += 4;
			return (reader.u32(frame.position - 4) | 0) / 65536;
		}
		frame.position++;
		let next = reader.u8(frame.position - 1);
		if (byte <= 250) return (byte - 247) * 256 + next + 108;
		return -(byte - 251) * 256 - next - 108;
	}

	/**
	 * Records and walks a `callsubr` or `callgsubr`; a missing subroutine ends the walk.
	 *
	 * @param global - Whether it calls into the Global Subr INDEX.
	 * @param depth - The caller's depth.
	 */
	#call(global: boolean, depth: number): void {
		let subrs = global ? this.#table.globalSubrs : this.#local;
		let number = this.#stack.pop();
		if (subrs === null || number === undefined || depth + 1 > MAX_CALL_DEPTH) {
			this.#ended = true;
			return;
		}
		let index = number + subroutineBias(subrs.count);
		let item = indexItem(subrs, index);
		if (item === null) {
			this.#ended = true;
			return;
		}
		this.#record(global, index);
		this.run({ position: item.offset, end: item.offset + item.length }, depth + 1);
	}

	/**
	 * Adds a reached subroutine to the use.
	 *
	 * @param global - Whether it is global.
	 * @param index - Its index in the INDEX.
	 */
	#record(global: boolean, index: number): void {
		if (global) {
			this.#use.global.add(index);
			return;
		}
		let local = this.#use.local.get(this.#fd);
		if (local === undefined) {
			local = new Set();
			this.#use.local.set(this.#fd, local);
		}
		local.add(index);
	}

	/**
	 * A two-byte operator. Path and no-op escapes clear the stack; any other one computes or
	 * stores values the walk does not evaluate, so the use turns dynamic and the walk stops.
	 *
	 * @param escape - The second byte.
	 */
	#escape(escape: number): void {
		this.#stack.length = 0;
		if (PATH_ESCAPES.has(escape)) return;
		this.#use.dynamic = true;
		this.#ended = true;
	}

	/**
	 * A one-byte operator other than the calls: stems are counted, `hintmask` skips its mask,
	 * `endchar` records a `seac`, and every other one clears the stack.
	 *
	 * @param op - Operator byte.
	 * @param frame - The running frame.
	 */
	#operator(op: number, frame: Frame): void {
		let stack = this.#stack;
		if (op === 1 || op === 3 || op === 18 || op === 23 || op === 19 || op === 20) {
			this.#stems += stack.length >> 1;
			stack.length = 0;
			if (op === 19 || op === 20) frame.position += (this.#stems + 7) >> 3;
			return;
		}
		if (op === 14) {
			if (stack.length >= 4) {
				for (let code of stack.slice(-2)) this.#use.seacCodes.add(code);
			}
			this.#ended = true;
			return;
		}
		stack.length = 0;
	}
}
