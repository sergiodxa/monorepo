/**
 * MurmurHash3 x86 32-bit at seed 0, the hash a percentage split buckets a
 * subject with. The reference engine hashes the same way, so a rollout
 * percentage written here selects the same subjects it selects there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Held for the life of the module so bucketing a subject allocates only the
 * byte array it hashes.
 */
const TEXT_ENCODER = new TextEncoder();

/**
 * Hashes a subject string to an unsigned 32-bit integer, spread evenly enough
 * that a ten percent bucket holds ten percent of subjects. The string is hashed
 * as its UTF-8 bytes, so a subject outside ASCII lands where the reference puts it.
 *
 * @param input The subject string, already assembled from seed and context field.
 * @returns A value in `[0, 2^32)`.
 * @example murmurHash3("welcome-banneruser-42") // 2364819184
 */
export function murmurHash3(input: string): number {
	let bytes = TEXT_ENCODER.encode(input);
	let tailLength = bytes.length % 4;
	let blockEnd = bytes.length - tailLength;
	let hash = 0;

	for (let index = 0; index < blockEnd; index += 4) {
		hash = mixBlock(hash, readBlock(bytes, index));
	}

	hash ^= scramble(readTail(bytes, blockEnd, tailLength));
	hash ^= bytes.length;

	return avalanche(hash) >>> 0;
}

/** Rotates within 32 bits, which is where the algorithm's diffusion comes from. */
function rotateLeft(value: number, bits: number): number {
	return (value << bits) | (value >>> (32 - bits));
}

/** Spreads one word's bits before it reaches the running hash. */
function scramble(block: number): number {
	return Math.imul(rotateLeft(Math.imul(block, 0xcc_9e_2d_51), 15), 0x1b_87_35_93);
}

/** Folds one whole word into the running hash, ordering-sensitively. */
function mixBlock(hash: number, block: number): number {
	return (Math.imul(rotateLeft(hash ^ scramble(block), 13), 5) + 0xe6_54_6b_64) | 0;
}

/** Finishes the hash so every input bit reaches every output bit. */
function avalanche(hash: number): number {
	let mixed = Math.imul(hash ^ (hash >>> 16), 0x85_eb_ca_6b);
	mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2_b2_ae_35);
	return mixed ^ (mixed >>> 16);
}

/** Reads a whole word little-endian, the byte order the algorithm is defined in. */
function readBlock(bytes: Uint8Array, start: number): number {
	return (
		(bytes[start] ?? 0) |
		((bytes[start + 1] ?? 0) << 8) |
		((bytes[start + 2] ?? 0) << 16) |
		((bytes[start + 3] ?? 0) << 24)
	);
}

/**
 * Packs the trailing bytes that do not fill a word into one, keeping their
 * little-endian positions so a one-byte tail differs from the same byte in
 * second position. A length of zero answers with zero, which mixes into nothing.
 */
function readTail(bytes: Uint8Array, start: number, length: number): number {
	let block = 0;

	if (length > 2) block ^= (bytes[start + 2] ?? 0) << 16;
	if (length > 1) block ^= (bytes[start + 1] ?? 0) << 8;
	if (length > 0) block ^= bytes[start] ?? 0;

	return block;
}
