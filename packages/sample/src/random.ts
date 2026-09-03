/**
 * The seeded stream every generated value is drawn from. Output depends on the
 * seed and on how many draws have been taken, and on nothing else, so the same
 * seed replays the same sequence on any machine and any day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { randomBytes } from "@sdxc/crypto";

/** A seed as a caller supplies it; text and numbers both name a stream. */
export type Seed = number | string;

/** A stream of pseudo-random values, and the draws that consume it. */
export interface Random {
	/** The seed this stream replays from. */
	readonly seed: Seed;
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
	/**
	 * An independent stream named by `label`. It is seeded from this stream's
	 * seed and the label alone, so its values hold still no matter how many
	 * draws this stream has taken or takes later.
	 */
	derive(label: string): Random;
}

/** Joins a seed to a label so `derive` composes into a readable seed. */
const LABEL_SEPARATOR = " ";

/**
 * Hash text into the four 32-bit words the generator starts from, so a seed can
 * be anything a caller finds meaningful and still spreads across the state.
 */
function hashSeed(seed: Seed): [number, number, number, number] {
	let text = String(seed);
	let a = 1779033703;
	let b = 3144134277;
	let c = 1013904242;
	let d = 2773480762;

	for (let index = 0; index < text.length; index++) {
		let code = text.charCodeAt(index);
		a = b ^ Math.imul(a ^ code, 597399067);
		b = c ^ Math.imul(b ^ code, 2869860233);
		c = d ^ Math.imul(c ^ code, 951274213);
		d = a ^ Math.imul(d ^ code, 2716044179);
	}

	a = Math.imul(c ^ (a >>> 18), 597399067);
	b = Math.imul(d ^ (b >>> 22), 2869860233);
	c = Math.imul(a ^ (c >>> 17), 951274213);
	d = Math.imul(b ^ (d >>> 19), 2716044179);

	return [(a ^ b ^ c ^ d) >>> 0, (b ^ a) >>> 0, (c ^ a) >>> 0, (d ^ a) >>> 0];
}

/**
 * The generator itself: four words of state advanced per draw, which buys a
 * long period and a flat distribution for a handful of integer operations.
 */
function generator(state: [number, number, number, number]): () => number {
	let [a, b, c, d] = state;

	return function next() {
		a |= 0;
		b |= 0;
		c |= 0;
		d |= 0;
		let sum = (((a + b) | 0) + d) | 0;
		d = (d + 1) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		c = (c + sum) | 0;
		return (sum >>> 0) / 4294967296;
	};
}

/**
 * Open a stream on a seed. Two streams on the same seed produce the same values
 * in the same order, which is what lets a run that used generated data be
 * reproduced from the seed alone.
 *
 * @param seed - Text or a number naming the stream to replay.
 * @returns The stream, positioned at its first value.
 * @example createRandom("signup-suite").int(1, 6)
 */
export function createRandom(seed: Seed): Random {
	let next = generator(hashSeed(seed));

	let random: Random = {
		seed,
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
		derive(label) {
			return createRandom(`${seed}${LABEL_SEPARATOR}${label}`);
		},
	};

	return random;
}

/**
 * Draw a seed from a cryptographically strong source, for a process that wants
 * fresh values on every run. Log the returned number and that run stays
 * reproducible by passing it back.
 *
 * @returns A 32-bit seed.
 * @example createRandom(systemSeed())
 */
export function systemSeed(): number {
	return randomBytes(4).reduce((seed, byte) => ((seed << 8) | byte) >>> 0, 0);
}
