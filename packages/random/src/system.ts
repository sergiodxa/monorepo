/**
 * Randomness drawn from `crypto.getRandomValues`: a well-spread source for
 * jitter, sampling and short tie-breakers, and the fresh seed a reproducible run
 * starts from. Both work in every runtime that ships Web Crypto.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "./draws.js";

import { drawsFrom } from "./draws.js";

/** Words fetched per refill, so a burst of draws costs one Web Crypto call. */
const BUFFER_WORDS = 64;

/**
 * Open an unseeded stream. Each draw is a fresh 32-bit value from Web Crypto,
 * so its sequence never repeats across calls, processes or runs.
 *
 * @returns A stream with the same draws a seeded stream offers.
 * @example systemRandom().float(0.8, 1.2)
 */
export function systemRandom(): Random {
	let buffer = new Uint32Array(BUFFER_WORDS);
	let position = BUFFER_WORDS;

	return drawsFrom(function next() {
		if (position === BUFFER_WORDS) {
			crypto.getRandomValues(buffer);
			position = 0;
		}
		return (buffer[position++] as number) / 4294967296;
	});
}

/**
 * Draw a seed from Web Crypto, for a process that wants fresh values on every
 * run. Log the returned number and that run stays reproducible by passing it back.
 *
 * @returns A 32-bit seed.
 * @example createRandom(systemSeed())
 */
export function systemSeed(): number {
	return crypto.getRandomValues(new Uint32Array(1))[0] as number;
}
