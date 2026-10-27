/**
 * Writes an outline as a Type 2 charstring: relative `rmoveto`, `rlineto` and `rrcurveto`
 * runs ending in `endchar`, with quadratic segments raised to cubics. A subset uses it to
 * store outlines it computed rather than copied, such as CFF2 glyphs drawn at an instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "../font.js";

/** Operands one `rlineto` takes before a new one starts, within CFF's 48-entry stack. */
const MAX_LINE_OPERANDS = 48;

/** Operands one `rrcurveto` takes before a new one starts, eight curves of six. */
const MAX_CURVE_OPERANDS = 48;

const RMOVETO = 21;
const RLINETO = 5;
const RRCURVETO = 8;
const ENDCHAR = 14;

/**
 * Encodes an outline in font units, y up, as a Type 2 charstring, points rounded to 1/65536
 * of a unit. The width operand, relative to `nominalWidth`, is written when `width` differs
 * from `defaultWidth`, so the charstring states the advance `hmtx` holds.
 *
 * @param commands - The outline; `close` ends a contour, as a following `rmoveto` does.
 * @param width - Advance width.
 * @param defaultWidth - The Private DICT's `defaultWidthX`.
 * @param nominalWidth - The Private DICT's `nominalWidthX`.
 * @example encodeCharstring(font.outline(glyph), font.advance(glyph), 0, 0)
 */
export function encodeCharstring(
	commands: readonly Font.Command[],
	width: number,
	defaultWidth = 0,
	nominalWidth = 0,
): Uint8Array {
	let writer = new CharstringWriter(width === defaultWidth ? null : width - nominalWidth);
	for (let command of commands) writer.add(command);
	return writer.finish();
}

/** Accumulates operators, merging consecutive lines and curves into one operator each. */
class CharstringWriter {
	#bytes: number[] = [];
	#pending: number[] = [];
	#pendingOp = 0;
	#x = 0;
	#y = 0;
	#width: number | null;

	/**
	 * @param width - The width operand the first `rmoveto` or `endchar` carries, or `null`.
	 */
	constructor(width: number | null) {
		this.#width = width;
	}

	/**
	 * Appends one outline command.
	 *
	 * @param command - The command, in absolute coordinates.
	 */
	add(command: Font.Command): void {
		if (command.type === "close") return;
		if (command.type === "move") {
			this.#flush();
			let operands = this.#takeWidth();
			let x = quantize(command.x);
			let y = quantize(command.y);
			operands.push(x - this.#x, y - this.#y);
			this.#emit(operands, RMOVETO);
			this.#moveTo(x, y);
			return;
		}
		if (command.type !== "quad" && command.type !== "cubic") {
			let x = quantize(command.x);
			let y = quantize(command.y);
			this.#queue(RLINETO, MAX_LINE_OPERANDS, [x - this.#x, y - this.#y]);
			this.#moveTo(x, y);
			return;
		}
		let controls = cubicControls(command, this.#x, this.#y);
		let c1x = quantize(controls.c1x);
		let c1y = quantize(controls.c1y);
		let c2x = quantize(controls.c2x);
		let c2y = quantize(controls.c2y);
		let x = quantize(command.x);
		let y = quantize(command.y);
		this.#queue(RRCURVETO, MAX_CURVE_OPERANDS, [
			c1x - this.#x,
			c1y - this.#y,
			c2x - c1x,
			c2y - c1y,
			x - c2x,
			y - c2y,
		]);
		this.#moveTo(x, y);
	}

	/** The finished charstring, ending in `endchar`. */
	finish(): Uint8Array {
		this.#flush();
		this.#emit(this.#takeWidth(), ENDCHAR);
		return Uint8Array.from(this.#bytes);
	}

	/**
	 * Adds operands to the run of `op`, starting a new run when the operator changes or the
	 * run would pass the stack limit.
	 *
	 * @param op - `rlineto` or `rrcurveto`.
	 * @param limit - The most operands one run holds.
	 * @param operands - One segment's operands.
	 */
	#queue(op: number, limit: number, operands: number[]): void {
		if (this.#pendingOp !== op || this.#pending.length + operands.length > limit) this.#flush();
		this.#pendingOp = op;
		this.#pending.push(...operands);
	}

	/** Writes the pending run, if any. */
	#flush(): void {
		if (this.#pending.length > 0) this.#emit(this.#pending, this.#pendingOp);
		this.#pending = [];
		this.#pendingOp = 0;
	}

	/** The width operand for the first stack-clearing operator, once. */
	#takeWidth(): number[] {
		let width = this.#width;
		this.#width = null;
		return width === null ? [] : [width];
	}

	/**
	 * Writes operands then an operator.
	 *
	 * @param operands - The operands.
	 * @param op - A one-byte operator.
	 */
	#emit(operands: readonly number[], op: number): void {
		for (let value of operands) this.#bytes.push(...charstringNumber(value));
		this.#bytes.push(op);
	}

	/**
	 * Moves the current point.
	 *
	 * @param x - Absolute x.
	 * @param y - Absolute y.
	 */
	#moveTo(x: number, y: number): void {
		this.#x = x;
		this.#y = y;
	}
}

/**
 * The two control points of a segment as a cubic; a quadratic is raised by placing them
 * two thirds of the way from each end point to its control point.
 *
 * @param command - A `quad` or `cubic` command.
 * @param x - Current point x.
 * @param y - Current point y.
 */
function cubicControls(
	command: Font.QuadCommand | Font.CubicCommand,
	x: number,
	y: number,
): { c1x: number; c1y: number; c2x: number; c2y: number } {
	if (command.type === "cubic") return command;
	return {
		c1x: x + ((command.cx - x) * 2) / 3,
		c1y: y + ((command.cy - y) * 2) / 3,
		c2x: command.x + ((command.cx - command.x) * 2) / 3,
		c2y: command.y + ((command.cy - command.y) * 2) / 3,
	};
}

/**
 * A coordinate rounded to the 1/65536 grid fixed-point operands hold. Deltas between grid
 * values are exact, so a reader summing them lands on the grid point with no drift.
 *
 * @param value - A coordinate in font units.
 */
function quantize(value: number): number {
	return Math.round(value * 65536) / 65536;
}

/**
 * A charstring operand: an integer in 1, 2 or 3 bytes, any other value as 16.16 fixed point,
 * which holds a fraction to 1/65536 of a unit.
 *
 * @param value - The operand; values past ±32767 are clamped to the fixed-point range.
 */
export function charstringNumber(value: number): number[] {
	if (Number.isInteger(value) && value >= -107 && value <= 107) return [value + 139];
	if (Number.isInteger(value) && value >= 108 && value <= 1131) {
		let rest = value - 108;
		return [(rest >> 8) + 247, rest & 0xff];
	}
	if (Number.isInteger(value) && value >= -1131 && value <= -108) {
		let rest = -value - 108;
		return [(rest >> 8) + 251, rest & 0xff];
	}
	if (Number.isInteger(value) && value >= -32768 && value <= 32767) {
		return [28, (value >> 8) & 0xff, value & 0xff];
	}
	let fixed = Math.round(Math.min(Math.max(value, -32768), 32767.99998) * 65536) | 0;
	return [255, (fixed >>> 24) & 0xff, (fixed >>> 16) & 0xff, (fixed >>> 8) & 0xff, fixed & 0xff];
}
