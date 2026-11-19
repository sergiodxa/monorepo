/**
 * A seeded random number source, so anything the synthesizer draws by chance (noise, a
 * generated melody) comes out the same for the same seed on every run and every runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A deterministic sequence of numbers in [0, 1) (mulberry32): the same seed always gives the
 * same sequence.
 *
 * @param seed Any integer; only its low 32 bits are used.
 * @returns A function returning the next number each time it is called.
 * @example let random = seededRandom(7); random(); // always the same first number for 7
 */
export function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/**
 * Turns a string into a 32-bit seed (FNV-1a), so a name such as a track id can seed a song.
 *
 * @param text Any string.
 * @example seedFrom("night-drive") // the same number on every run
 */
export function seedFrom(text: string): number {
	let value = 2166136261;
	for (let char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
	return value >>> 0;
}
