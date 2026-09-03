/**
 * Numbers, as an options object rather than positional bounds, so a call reads
 * the same whether it sets one end of the range or both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "../random.js";

/** Roman numerals, largest first, for the greedy conversion below. */
const ROMAN_NUMERALS = [
	[1000, "M"],
	[900, "CM"],
	[500, "D"],
	[400, "CD"],
	[100, "C"],
	[90, "XC"],
	[50, "L"],
	[40, "XL"],
	[10, "X"],
	[9, "IX"],
	[5, "V"],
	[4, "IV"],
	[1, "I"],
] as const;

/** The largest value a roman numeral is written for. */
const ROMAN_LIMIT = 3999;

/** Options for a generated integer. */
export interface IntOptions {
	/** Lowest value, included. Defaults to 0. */
	min?: number;
	/** Highest value, included. Defaults to 100. */
	max?: number;
}

/** Options for a generated fractional number. */
export interface FloatOptions {
	/** Lowest value, included. Defaults to 0. */
	min?: number;
	/** Highest value, excluded. Defaults to 1. */
	max?: number;
	/** How many digits to keep after the point. Defaults to 2. */
	fractionDigits?: number;
}

/** Options for a number written in another base. */
export interface BaseOptions {
	/** Lowest value, included. Defaults to 0. */
	min?: number;
	/** Highest value, included. Defaults to 255. */
	max?: number;
}

/** Options for a big integer. */
export interface BigIntOptions {
	min?: bigint;
	max?: bigint;
}

/** Integers, fractional numbers, and numbers written in another base. */
export interface NumberModule {
	/**
	 * An integer in `[min, max]`.
	 *
	 * @throws RangeError when a bound is not a safe integer, or `max` is below
	 * `min`.
	 */
	int(options?: IntOptions): number;
	/** A number in `[min, max)`, rounded to `fractionDigits`. */
	float(options?: FloatOptions): number;
	/** An integer written in base 16. */
	hex(options?: BaseOptions): string;
	/** An integer written in base 2. */
	binary(options?: BaseOptions): string;
	/** An integer written in base 8. */
	octal(options?: BaseOptions): string;
	/** An integer in `[1, 3999]`, written in roman numerals. */
	romanNumeral(options?: IntOptions): string;
	/** An integer too large for `number`, as a `bigint`. */
	bigInt(options?: BigIntOptions): bigint;
}

/** Create the `number` module over one stream. */
export function createNumberModule(random: Random): NumberModule {
	function inBase(options: BaseOptions = {}, radix: number): string {
		return random.int(options.min ?? 0, options.max ?? 255).toString(radix);
	}

	let numbers: NumberModule = {
		int(options = {}) {
			return random.int(options.min ?? 0, options.max ?? 100);
		},
		float(options = {}) {
			let value = random.float(options.min ?? 0, options.max ?? 1);
			return Number(value.toFixed(options.fractionDigits ?? 2));
		},
		hex(options) {
			return inBase(options, 16);
		},
		binary(options) {
			return inBase(options, 2);
		},
		octal(options) {
			return inBase(options, 8);
		},
		romanNumeral(options = {}) {
			let value = random.int(options.min ?? 1, options.max ?? ROMAN_LIMIT);
			if (value < 1 || value > ROMAN_LIMIT) {
				throw new RangeError(`romanNumeral() writes values in 1..${ROMAN_LIMIT}, got ${value}.`);
			}
			let remaining = value;
			let written = "";
			for (let [amount, numeral] of ROMAN_NUMERALS) {
				while (remaining >= amount) {
					written += numeral;
					remaining -= amount;
				}
			}
			return written;
		},
		bigInt(options = {}) {
			let min = options.min ?? 0n;
			let max = options.max ?? 9_007_199_254_740_991n * 2n;
			if (max < min) {
				throw new RangeError(`bigInt() needs max (${max}) to be at least min (${min}).`);
			}
			/**
			 * Drawn digit by digit in base 2^16, so the value spans the whole range
			 * rather than the 53 bits a `number` could carry.
			 */
			let span = max - min + 1n;
			let value = 0n;
			for (let index = 0; index < 8; index++)
				value = (value << 16n) | BigInt(random.int(0, 0xffff));
			return min + (value % span);
		},
	};

	return numbers;
}
