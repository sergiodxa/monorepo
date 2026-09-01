/**
 * Numbers, as an options object rather than positional bounds, so a call reads
 * the same whether it sets one end of the range or both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "../random";

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

/** Integers and fractional numbers. */
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
}

/** Create the `number` module over one stream. */
export function createNumberModule(random: Random): NumberModule {
	return {
		int(options = {}) {
			return random.int(options.min ?? 0, options.max ?? 100);
		},
		float(options = {}) {
			let value = random.float(options.min ?? 0, options.max ?? 1);
			return Number(value.toFixed(options.fractionDigits ?? 2));
		},
	};
}
