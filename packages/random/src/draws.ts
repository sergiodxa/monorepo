/**
 * The `Random` interface and the draws built on a raw `[0, 1)` source. Every
 * stream, seeded or system, shares these definitions, so `int`, `pick` and
 * `shuffle` carry one set of bounds and one set of errors across the package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A source of random values, and the draws that consume it. */
export interface Random {
	/** The next raw draw, in `[0, 1)`. */
	next(): number;
	/**
	 * An integer in `[min, max]`, both ends included.
	 *
	 * @throws RangeError when a bound is not a safe integer, or `max` is below
	 * `min`.
	 */
	int(min: number, max: number): number;
	/** A number in `[min, max)`, defaulting to `[0, 1)`. */
	float(min?: number, max?: number): number;
	/** `true` with probability `chance`, half the time by default. */
	bool(chance?: number): boolean;
	/**
	 * One element, every element equally likely.
	 *
	 * @throws RangeError when the list is empty.
	 */
	pick<T>(items: readonly T[]): T;
	/** A shuffled copy; the argument keeps its order. */
	shuffle<T>(items: readonly T[]): T[];
}

/**
 * Build every draw on top of `next`. Each draw consumes a fixed number of raw
 * values for a given input, which is what keeps a seeded sequence stable.
 *
 * @param next - The raw source, returning values in `[0, 1)`.
 * @returns The draws, all reading from `next`.
 */
export function drawsFrom(next: () => number): Random {
	let random: Random = {
		next,
		int(min, max) {
			if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
				throw new RangeError(`int() needs safe integer bounds, received ${min} and ${max}.`);
			}
			if (max < min) throw new RangeError(`int() needs max (${max}) to be at least min (${min}).`);
			return min + Math.floor(next() * (max - min + 1));
		},
		float(min = 0, max = 1) {
			return min + next() * (max - min);
		},
		bool(chance = 0.5) {
			return next() < chance;
		},
		pick(items) {
			if (items.length === 0) throw new RangeError("pick() needs a list with at least one item.");
			return items[random.int(0, items.length - 1)] as (typeof items)[number];
		},
		shuffle(items) {
			let copy = [...items];
			for (let index = copy.length - 1; index > 0; index--) {
				let target = random.int(0, index);
				let held = copy[index] as (typeof copy)[number];
				copy[index] = copy[target] as (typeof copy)[number];
				copy[target] = held;
			}
			return copy;
		},
	};

	return random;
}
