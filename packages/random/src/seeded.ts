/**
 * The seeded stream: output depends on the seed and on how many draws have been
 * taken, and on nothing else, so a seed replays the same sequence on any machine.
 * Its four words of state can be saved and restored to resume a stream mid-way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "./draws.js";

import { drawsFrom } from "./draws.js";

/** A seed as a caller supplies it; text and numbers both name a stream. */
export type Seed = number | string;

/**
 * Where a seeded stream stands. It is plain JSON, so it can be stored beside the
 * data it produced and handed back to `restoreRandom` later.
 */
export interface RandomState {
	/** The seed the stream was opened on, which `derive` keeps building from. */
	seed: Seed;
	/** The generator's four unsigned 32-bit words. */
	words: [number, number, number, number];
}

/** A stream that can be replayed, derived from and persisted. */
export interface SeededRandom extends Random {
	/** The seed this stream replays from. */
	readonly seed: Seed;
	/**
	 * An independent stream named by `label`. It is seeded from this stream's
	 * seed and the label alone, so its values hold still no matter how many
	 * draws this stream has taken or takes later.
	 */
	derive(label: string): SeededRandom;
	/** A snapshot that `restoreRandom` resumes from the next draw on. */
	state(): RandomState;
}

/** Joins a seed to a label so `derive` composes into a readable seed. */
const LABEL_SEPARATOR = " ";

/**
 * Hash text into the four 32-bit words the generator starts from, so a seed can
 * be anything a caller finds meaningful and still spreads across the state.
 */
function hashSeed(seed: Seed): RandomState["words"] {
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
 * Open the generator on `seed` positioned at `words`: four words of state
 * advanced per draw, which buys a long period and a flat distribution for a
 * handful of integer operations.
 */
function seededStream(seed: Seed, words: RandomState["words"]): SeededRandom {
	let [a, b, c, d] = words;

	/** Advance the state one step and read the draw it produced. */
	function next() {
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
	}

	return {
		...drawsFrom(next),
		seed,
		derive(label) {
			return createRandom(`${seed}${LABEL_SEPARATOR}${label}`);
		},
		state() {
			return { seed, words: [a >>> 0, b >>> 0, c >>> 0, d >>> 0] };
		},
	};
}

/**
 * Open a stream on a seed. Two streams on the same seed produce the same values
 * in the same order, which is what lets a run be reproduced from the seed alone.
 *
 * @param seed - Text or a number naming the stream to replay.
 * @returns The stream, positioned at its first value.
 * @example createRandom("battle-42").int(1, 6)
 */
export function createRandom(seed: Seed): SeededRandom {
	return seededStream(seed, hashSeed(seed));
}

/**
 * Resume a stream from a snapshot. The restored stream draws exactly what the
 * original would have drawn next, and derives the same streams it would have.
 *
 * @param state - A snapshot from `state()`; validate one read from storage with `RANDOM_STATE_SCHEMA`.
 * @returns The stream, positioned where the snapshot was taken.
 * @example restoreRandom(saved.random).int(1, 6)
 */
export function restoreRandom(state: RandomState): SeededRandom {
	return seededStream(state.seed, [...state.words]);
}
