/**
 * Test streams whose raw draws are scripted, for tests that pin an exact roll.
 * The draws on top use the same formulas as `@sdxc/random`, so a scripted raw
 * value lands on the integer, choice or chance the production stream would.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "@sdxc/random";

import type { Engine } from "~/game/engine";

/**
 * Builds a `Random` over a raw source. The source may return values outside
 * `[0, 1)`, such as `1` to force every chance roll to fail; the draws apply
 * their formulas to it unchanged.
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

/**
 * A stream whose raw draws are `values` in order, repeating the last once the
 * script runs out, and `0` for an empty script.
 *
 * @example scriptedRandom(1) // every chance roll fails, every spread maxes out
 * @example scriptedRandom(0.5, 0.5, 0) // two turn-order rolls, then a passing escape roll
 */
export function scriptedRandom(...values: number[]): Random {
	let index = 0;
	return drawsFrom(() => {
		let value = values[index] ?? values.at(-1) ?? 0;
		index += 1;
		return value;
	});
}

/** Engine streams that all draw from `random`, for a test scripting one sequence across them. */
export function sharedStreams(random: Random): Engine.Streams {
	return { creatures: random, battle: random };
}
