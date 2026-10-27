/**
 * Type 2 charstring interpreter: runs one glyph's charstring, its subroutine calls and, in
 * CFF2, its blends, and emits the outline as move/line/cubic/close commands. Limits on the
 * stack, call depth and work done keep a hostile charstring from hanging or overflowing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "../font.js";
import type { Reader } from "../reader.js";

import type { CffIndex } from "./index-table.js";
import type { CffTable } from "./table.js";

import { indexItem } from "./index-table.js";

/** What running a charstring needs beyond the table. */
export interface CharstringContext {
	reader: Reader;
	table: CffTable;
	/**
	 * The scalar of each region of an ItemVariationStore subtable at the instance being drawn;
	 * all zeros draws the default instance. Used by CFF2 `blend`.
	 */
	blendScalars(vsindex: number): readonly number[];
	/**
	 * The glyph a Standard encoding code names, for the `seac` form of `endchar`; `null`
	 * when the font has no such glyph or no charset to find it through.
	 */
	standardGlyph(code: number): number | null;
}

/** A decoded charstring. */
export interface Charstring {
	commands: Font.Command[];
	/** The advance width the charstring states, or the Private DICT's `defaultWidthX`. */
	width: number;
}

/** Deepest subroutine nesting the Type 2 format allows. */
const MAX_CALL_DEPTH = 10;

/** Operators one glyph may execute, subroutines included, before decoding stops. */
const MAX_OPERATIONS = 100_000;

/** Commands one glyph may emit before decoding stops. */
const MAX_COMMANDS = 65_536;

/** Slots of the transient array `put` and `get` address. */
const TRANSIENT_SIZE = 32;

/** Sentinel thrown nowhere: the interpreter returns it to unwind a stopped charstring. */
const STOP = -1;

/** The interpreter's reading position inside one charstring or subroutine. */
interface Frame {
	position: number;
	end: number;
}

/**
 * Runs the charstring of `glyph`. A charstring that breaks a limit, calls a missing
 * subroutine or uses an unknown operator ends there: the commands drawn so far are kept,
 * with the open contour closed.
 *
 * @param context - The parsed table and how to blend and resolve `seac`.
 * @param glyph - Glyph index.
 */
export function runCharstring(context: CharstringContext, glyph: number): Charstring {
	let interpreter = new Interpreter(context, glyph, true);
	return interpreter.run(glyph);
}

/** One run of a glyph's charstring, holding the Type 2 machine's state. */
class Interpreter {
	readonly commands: Font.Command[] = [];
	#context: CharstringContext;
	#cff2: boolean;
	#stack: number[] = [];
	#maxStack: number;
	#transient: number[] = Array.from({ length: TRANSIENT_SIZE }, () => 0);
	#x = 0;
	#y = 0;
	#open = false;
	#stems = 0;
	#width: number | null = null;
	#operations = 0;
	#vsindex: number;
	#nominalWidth: number;
	#defaultWidth: number;
	#localSubrs: CffIndex | null;
	#allowSeac: boolean;
	#seed: number;
	#ended = false;

	/**
	 * @param context - The parsed table and its callbacks.
	 * @param glyph - Glyph index, which picks the Private DICT.
	 * @param allowSeac - Whether `endchar` may compose an accented glyph; off inside one.
	 */
	constructor(context: CharstringContext, glyph: number, allowSeac: boolean) {
		let table = context.table;
		this.#context = context;
		this.#cff2 = table.version === 2;
		this.#maxStack = table.maxStack;
		let fd = table.fdSelect?.fds[glyph] ?? 0;
		let found = table.fontDicts[fd] ?? table.fontDicts[0];
		this.#vsindex = found?.private.vsindex ?? 0;
		this.#nominalWidth = found?.private.nominalWidthX ?? 0;
		this.#defaultWidth = found?.private.defaultWidthX ?? 0;
		this.#localSubrs = found?.private.subrs ?? null;
		this.#allowSeac = allowSeac;
		this.#seed = glyph + 1;
	}

	/**
	 * Interprets the glyph's charstring and returns its outline and width.
	 *
	 * @param glyph - Glyph index.
	 */
	run(glyph: number): Charstring {
		let item = indexItem(this.#context.table.charStrings, glyph);
		if (item !== null) this.#execute({ position: item.offset, end: item.offset + item.length }, 0);
		this.#close();
		return { commands: this.commands, width: this.#width ?? this.#defaultWidth };
	}

	/**
	 * Runs one charstring or subroutine to its end, `return` or `endchar`.
	 *
	 * @param frame - Where its bytes are.
	 * @param depth - How many calls deep it runs.
	 * @returns `STOP` when decoding must end, `0` otherwise.
	 */
	#execute(frame: Frame, depth: number): number {
		let reader = this.#context.reader;
		while (frame.position < frame.end && !this.#ended) {
			let byte = reader.u8(frame.position);
			frame.position++;
			if (byte >= 32 || byte === 28) {
				if (!this.#push(this.#number(byte, frame))) return STOP;
				continue;
			}
			this.#operations++;
			if (this.#operations > MAX_OPERATIONS || this.commands.length > MAX_COMMANDS) return STOP;
			if (byte === 10 || byte === 29) {
				if (this.#call(byte === 29, depth) === STOP) return STOP;
				continue;
			}
			if (byte === 11) {
				if (this.#cff2) continue;
				return 0;
			}
			if (byte === 12) {
				let escape = reader.u8(frame.position);
				frame.position++;
				if (!this.#escape(escape)) return STOP;
				continue;
			}
			if (!this.#operator(byte, frame)) return STOP;
		}
		return 0;
	}

	/**
	 * Reads an operand whose first byte is `byte`: integers in 1, 2 or 3 bytes, or a 16.16
	 * fixed-point number after `255`.
	 *
	 * @param byte - The first byte, already consumed.
	 * @param frame - Positioned after it.
	 */
	#number(byte: number, frame: Frame): number {
		let reader = this.#context.reader;
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
	 * Pushes an operand, refusing past the font's stack limit.
	 *
	 * @param value - The operand.
	 */
	#push(value: number): boolean {
		if (this.#stack.length >= this.#maxStack) return false;
		this.#stack.push(value);
		return true;
	}

	/**
	 * `callsubr` or `callgsubr`: pops a biased subroutine number and runs it.
	 *
	 * @param global - Whether it calls into the Global Subr INDEX.
	 * @param depth - The caller's depth.
	 */
	#call(global: boolean, depth: number): number {
		let subrs = global ? this.#context.table.globalSubrs : this.#localSubrs;
		let number = this.#stack.pop();
		if (subrs === null || number === undefined || depth + 1 > MAX_CALL_DEPTH) return STOP;
		let item = indexItem(subrs, number + subroutineBias(subrs.count));
		if (item === null) return STOP;
		return this.#execute({ position: item.offset, end: item.offset + item.length }, depth + 1);
	}

	/**
	 * Takes the advance width off the bottom of the stack the first time a stack-clearing
	 * operator finds one operand more than it uses. CFF2 charstrings carry no width.
	 *
	 * @param extra - Whether the operator found the extra operand.
	 */
	#takeWidth(extra: boolean): void {
		if (this.#width !== null || this.#cff2) return;
		if (!extra) {
			this.#width = this.#defaultWidth;
			return;
		}
		this.#width = (this.#stack.shift() ?? 0) + this.#nominalWidth;
	}

	/**
	 * Runs a one-byte operator other than the subroutine calls.
	 *
	 * @param op - Operator byte.
	 * @param frame - The running frame, which `hintmask` skips its mask bytes in.
	 * @returns `false` to stop decoding.
	 */
	#operator(op: number, frame: Frame): boolean {
		let stack = this.#stack;
		switch (op) {
			case 1:
			case 3:
			case 18:
			case 23:
				this.#stemHints();
				return true;
			case 19:
			case 20:
				this.#stemHints();
				frame.position += (this.#stems + 7) >> 3;
				return true;
			case 4:
				this.#takeWidth(stack.length > 1);
				this.#moveTo(this.#x, this.#y + (stack.at(-1) ?? 0));
				break;
			case 21:
				this.#takeWidth(stack.length > 2);
				this.#moveTo(this.#x + (stack.at(-2) ?? 0), this.#y + (stack.at(-1) ?? 0));
				break;
			case 22:
				this.#takeWidth(stack.length > 1);
				this.#moveTo(this.#x + (stack.at(-1) ?? 0), this.#y);
				break;
			case 5:
				this.#lines(stack, 0, stack.length);
				break;
			case 6:
			case 7:
				this.#alternatingLines(op === 6);
				break;
			case 8:
				this.#curves(stack, 0, stack.length);
				break;
			case 24:
				this.#curves(stack, 0, stack.length - 2);
				this.#lines(stack, Math.max(stack.length - 2, 0), stack.length);
				break;
			case 25:
				this.#lines(stack, 0, stack.length - 6);
				this.#curves(stack, Math.max(stack.length - 6, 0), stack.length);
				break;
			case 26:
				this.#vvCurves();
				break;
			case 27:
				this.#hhCurves();
				break;
			case 30:
			case 31:
				this.#alternatingCurves(op === 31);
				break;
			case 14:
				if (this.#cff2) return true;
				return this.#endchar();
			case 15:
				if (!this.#cff2) return false;
				this.#vsindex = stack.pop() ?? 0;
				return true;
			case 16:
				return this.#cff2 && this.#blend();
			default:
				return false;
		}
		stack.length = 0;
		return true;
	}

	/** Counts the stem hints an operator declares; the hints themselves are skipped. */
	#stemHints(): void {
		this.#takeWidth(this.#stack.length % 2 === 1);
		this.#stems += this.#stack.length >> 1;
		this.#stack.length = 0;
	}

	/**
	 * Starts a contour at an absolute point, closing the one before it.
	 *
	 * @param x - Absolute x.
	 * @param y - Absolute y.
	 */
	#moveTo(x: number, y: number): void {
		this.#close();
		this.#x = x;
		this.#y = y;
		this.commands.push({ type: "move", x, y });
		this.#open = true;
	}

	/** Closes the open contour, if there is one. */
	#close(): void {
		if (!this.#open) return;
		this.commands.push({ type: "close" });
		this.#open = false;
	}

	/**
	 * Draws a line to a point relative to the current one.
	 *
	 * @param dx - Relative x.
	 * @param dy - Relative y.
	 */
	#line(dx: number, dy: number): void {
		this.#x += dx;
		this.#y += dy;
		this.commands.push({ type: "line", x: this.#x, y: this.#y });
	}

	/**
	 * Draws a cubic whose control points and end are each relative to the point before.
	 *
	 * @param values - `dxa dya dxb dyb dxc dyc`.
	 */
	#curve(...values: number[]): void {
		let [dxa = 0, dya = 0, dxb = 0, dyb = 0, dxc = 0, dyc = 0] = values;
		let c1x = this.#x + dxa;
		let c1y = this.#y + dya;
		let c2x = c1x + dxb;
		let c2y = c1y + dyb;
		this.#x = c2x + dxc;
		this.#y = c2y + dyc;
		this.commands.push({ type: "cubic", c1x, c1y, c2x, c2y, x: this.#x, y: this.#y });
	}

	/**
	 * `rlineto` pairs from `from` up to `to`.
	 *
	 * @param values - The operands.
	 * @param from - First operand.
	 * @param to - End of the operands.
	 */
	#lines(values: number[], from: number, to: number): void {
		for (let index = from; index + 1 < to; index += 2) {
			this.#line(values[index] ?? 0, values[index + 1] ?? 0);
		}
	}

	/**
	 * `rrcurveto` sextets from `from` up to `to`.
	 *
	 * @param values - The operands.
	 * @param from - First operand.
	 * @param to - End of the operands.
	 */
	#curves(values: number[], from: number, to: number): void {
		for (let index = from; index + 5 < to; index += 6)
			this.#curve(...values.slice(index, index + 6));
	}

	/**
	 * `hlineto` and `vlineto`: lines alternating horizontal and vertical.
	 *
	 * @param horizontal - Whether the first line is horizontal.
	 */
	#alternatingLines(horizontal: boolean): void {
		let phase = horizontal;
		for (let value of this.#stack) {
			if (phase) this.#line(value, 0);
			else this.#line(0, value);
			phase = !phase;
		}
	}

	/** `vvcurveto`: vertical-tangent curves, the first optionally starting with a dx. */
	#vvCurves(): void {
		let stack = this.#stack;
		let index = 0;
		let dx = 0;
		if (stack.length % 2 === 1) {
			dx = stack[0] ?? 0;
			index = 1;
		}
		for (; index + 3 < stack.length; index += 4) {
			this.#curve(
				dx,
				stack[index] ?? 0,
				stack[index + 1] ?? 0,
				stack[index + 2] ?? 0,
				0,
				stack[index + 3] ?? 0,
			);
			dx = 0;
		}
	}

	/** `hhcurveto`: horizontal-tangent curves, the first optionally starting with a dy. */
	#hhCurves(): void {
		let stack = this.#stack;
		let index = 0;
		let dy = 0;
		if (stack.length % 2 === 1) {
			dy = stack[0] ?? 0;
			index = 1;
		}
		for (; index + 3 < stack.length; index += 4) {
			this.#curve(
				stack[index] ?? 0,
				dy,
				stack[index + 1] ?? 0,
				stack[index + 2] ?? 0,
				stack[index + 3] ?? 0,
				0,
			);
			dy = 0;
		}
	}

	/**
	 * `hvcurveto` and `vhcurveto`: curves alternating horizontal and vertical tangents, the
	 * last taking a fifth operand for its otherwise fixed end coordinate.
	 *
	 * @param horizontal - Whether the first curve starts horizontal.
	 */
	#alternatingCurves(horizontal: boolean): void {
		let stack = this.#stack;
		let phase = horizontal;
		for (let index = 0; index + 3 < stack.length; index += 4) {
			let [a = 0, b = 0, c = 0, d = 0] = stack.slice(index, index + 4);
			let last = stack.length - index === 5 ? (stack[index + 4] ?? 0) : 0;
			if (phase) this.#curve(a, 0, b, c, last, d);
			else this.#curve(0, a, b, c, d, last);
			phase = !phase;
		}
	}

	/**
	 * `endchar`: closes the outline, or with four operands composes an accented glyph from
	 * a base and an accent named by Standard encoding codes.
	 *
	 * @returns `false` when the composition cannot be drawn.
	 */
	#endchar(): boolean {
		let stack = this.#stack;
		this.#takeWidth(stack.length === 1 || stack.length === 5);
		this.#ended = true;
		if (stack.length < 4) return true;
		let [adx = 0, ady = 0, base = 0, accent = 0] = stack.slice(-4);
		stack.length = 0;
		return this.#seac(adx, ady, base, accent);
	}

	/**
	 * Draws the base glyph, then the accent offset by `(adx, ady)`, as one outline.
	 *
	 * @param adx - Accent x offset.
	 * @param ady - Accent y offset.
	 * @param baseCode - Standard encoding code of the base.
	 * @param accentCode - Standard encoding code of the accent.
	 */
	#seac(adx: number, ady: number, baseCode: number, accentCode: number): boolean {
		if (!this.#allowSeac) return false;
		let base = this.#context.standardGlyph(baseCode);
		let accent = this.#context.standardGlyph(accentCode);
		if (base === null || accent === null) return false;
		this.#close();
		let width = this.#width;
		this.commands.length = 0;
		this.commands.push(...new Interpreter(this.#context, base, false).run(base).commands);
		for (let command of new Interpreter(this.#context, accent, false).run(accent).commands) {
			this.commands.push(translate(command, adx, ady));
		}
		this.#width = width;
		return true;
	}

	/**
	 * CFF2 `blend`: replaces `n` default values and their per-region deltas with the values
	 * at the current instance, `value + sum(delta * scalar)`.
	 */
	#blend(): boolean {
		let stack = this.#stack;
		let count = stack.pop();
		let scalars = this.#context.blendScalars(this.#vsindex);
		if (count === undefined || !Number.isInteger(count) || count < 0) return false;
		let base = stack.length - count * (scalars.length + 1);
		if (base < 0) return false;
		let delta = base + count;
		for (let value = 0; value < count; value++) {
			let sum = stack[base + value] ?? 0;
			for (let scalar of scalars) {
				sum += scalar * (stack[delta] ?? 0);
				delta++;
			}
			stack[base + value] = sum;
		}
		stack.length = base + count;
		return true;
	}

	/**
	 * Runs a two-byte `12 x` operator: the flex curves and the arithmetic, storage and
	 * conditional operators.
	 *
	 * @param op - The second byte.
	 * @returns `false` to stop decoding.
	 */
	#escape(op: number): boolean {
		if (op >= 34 && op <= 37) {
			this.#flex(op);
			this.#stack.length = 0;
			return true;
		}
		if (this.#cff2) return false;
		return this.#arithmetic(op);
	}

	/**
	 * `hflex`, `flex`, `hflex1` and `flex1`: two curves; the flex depth operand only matters
	 * to a hinting rasterizer.
	 *
	 * @param op - The second operator byte, 34–37.
	 */
	#flex(op: number): void {
		let stack = this.#stack;
		let at = (index: number): number => stack[index] ?? 0;
		if (op === 34) {
			let y = this.#y;
			this.#curve(at(0), 0, at(1), at(2), at(3), 0);
			this.#curve(at(4), 0, at(5), y - this.#y, at(6), 0);
			return;
		}
		if (op === 35) {
			this.#curve(at(0), at(1), at(2), at(3), at(4), at(5));
			this.#curve(at(6), at(7), at(8), at(9), at(10), at(11));
			return;
		}
		if (op === 36) {
			let y = this.#y;
			this.#curve(at(0), at(1), at(2), at(3), at(4), 0);
			this.#curve(at(5), 0, at(6), at(7), at(8), 0);
			this.#y = y;
			let last = this.commands.at(-1);
			if (last?.type === "cubic") last.y = y;
			return;
		}
		this.#flex1(at);
	}

	/**
	 * `flex1`: the last point moves along whichever axis the curves travelled further on,
	 * and returns to the starting coordinate on the other.
	 *
	 * @param at - The operand at an index.
	 */
	#flex1(at: (index: number) => number): void {
		let startX = this.#x;
		let startY = this.#y;
		let dx = 0;
		let dy = 0;
		for (let index = 0; index < 10; index += 2) {
			dx += at(index);
			dy += at(index + 1);
		}
		this.#curve(at(0), at(1), at(2), at(3), at(4), at(5));
		let horizontal = Math.abs(dx) > Math.abs(dy);
		let c1x = this.#x + at(6);
		let c1y = this.#y + at(7);
		let c2x = c1x + at(8);
		let c2y = c1y + at(9);
		this.#x = horizontal ? c2x + at(10) : startX;
		this.#y = horizontal ? startY : c2y + at(10);
		this.commands.push({ type: "cubic", c1x, c1y, c2x, c2y, x: this.#x, y: this.#y });
	}

	/**
	 * The Type 2 arithmetic, storage and conditional operators.
	 *
	 * @param op - The second operator byte.
	 * @returns `false` for an operator the format does not define.
	 */
	#arithmetic(op: number): boolean {
		let stack = this.#stack;
		let pop = (): number => stack.pop() ?? 0;
		let b: number;
		let a: number;
		switch (op) {
			case 3:
				b = pop();
				a = pop();
				return this.#push(a !== 0 && b !== 0 ? 1 : 0);
			case 4:
				b = pop();
				a = pop();
				return this.#push(a !== 0 || b !== 0 ? 1 : 0);
			case 5:
				return this.#push(pop() === 0 ? 1 : 0);
			case 9:
				return this.#push(Math.abs(pop()));
			case 10:
				b = pop();
				return this.#push(pop() + b);
			case 11:
				b = pop();
				return this.#push(pop() - b);
			case 12:
				b = pop();
				a = pop();
				return this.#push(b === 0 ? 0 : a / b);
			case 14:
				return this.#push(-pop());
			case 15:
				b = pop();
				return this.#push(pop() === b ? 1 : 0);
			case 18:
				pop();
				return true;
			case 20:
				a = pop();
				b = pop();
				if (a >= 0 && a < TRANSIENT_SIZE) this.#transient[Math.trunc(a)] = b;
				return true;
			case 21:
				a = pop();
				return this.#push(this.#transient[Math.trunc(a)] ?? 0);
			case 22:
				return this.#ifelse();
			case 23:
				return this.#push(this.#random());
			case 24:
				b = pop();
				return this.#push(pop() * b);
			case 26:
				return this.#push(Math.sqrt(Math.max(pop(), 0)));
			case 27:
				a = pop();
				return this.#push(a) && this.#push(a);
			case 28:
				b = pop();
				a = pop();
				return this.#push(b) && this.#push(a);
			case 29:
				return this.#index();
			case 30:
				return this.#roll();
			default:
				return false;
		}
	}

	/** `s1 s2 v1 v2 ifelse`: leaves `s1` when `v1 <= v2`, `s2` otherwise. */
	#ifelse(): boolean {
		let stack = this.#stack;
		let v2 = stack.pop() ?? 0;
		let v1 = stack.pop() ?? 0;
		let s2 = stack.pop() ?? 0;
		let s1 = stack.pop() ?? 0;
		return this.#push(v1 <= v2 ? s1 : s2);
	}

	/** `index`: copies the element `i` below the top; a negative `i` copies the top. */
	#index(): boolean {
		let stack = this.#stack;
		let i = Math.trunc(stack.pop() ?? 0);
		if (i < 0) i = 0;
		let value = stack[stack.length - 1 - i] ?? 0;
		return this.#push(value);
	}

	/** `n j roll`: rotates the top `n` elements by `j` positions towards the top. */
	#roll(): boolean {
		let stack = this.#stack;
		let shift = Math.trunc(stack.pop() ?? 0);
		let count = Math.trunc(stack.pop() ?? 0);
		if (count <= 0 || count > stack.length) return true;
		let top = stack.splice(stack.length - count, count);
		let by = ((shift % count) + count) % count;
		stack.push(...top.slice(count - by), ...top.slice(0, count - by));
		return true;
	}

	/** A number in (0, 1], seeded by the glyph so a glyph always draws the same outline. */
	#random(): number {
		this.#seed = (this.#seed * 1103515245 + 12345) % 2147483648;
		return (this.#seed + 1) / 2147483648;
	}
}

/**
 * The bias added to a subroutine number, which lets charstrings address up to 64K
 * subroutines with short operands.
 *
 * @param count - Subroutines in the INDEX.
 */
export function subroutineBias(count: number): number {
	if (count < 1240) return 107;
	if (count < 33900) return 1131;
	return 32768;
}

/**
 * A command moved by `(dx, dy)`.
 *
 * @param command - The command.
 * @param dx - Horizontal offset.
 * @param dy - Vertical offset.
 */
function translate(command: Font.Command, dx: number, dy: number): Font.Command {
	if (command.type === "close") return command;
	if (command.type === "cubic") {
		return {
			type: "cubic",
			c1x: command.c1x + dx,
			c1y: command.c1y + dy,
			c2x: command.c2x + dx,
			c2y: command.c2y + dy,
			x: command.x + dx,
			y: command.y + dy,
		};
	}
	if (command.type === "quad") {
		return {
			type: "quad",
			cx: command.cx + dx,
			cy: command.cy + dy,
			x: command.x + dx,
			y: command.y + dy,
		};
	}
	return { type: command.type, x: command.x + dx, y: command.y + dy };
}
