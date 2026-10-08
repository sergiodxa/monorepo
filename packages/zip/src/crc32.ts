/**
 * CRC-32 as ZIP, PNG and gzip define it (IEEE 802.3, reflected polynomial `0xEDB88320`),
 * the checksum every ZIP entry records. The lookup table is built on the first call, so
 * importing the module costs a Worker nothing at startup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The 256-entry table, filled by the first {@link crc32} call and reused after it. */
let table: Uint32Array | undefined;

/**
 * Checksums `bytes`, continuing from `previous` so a caller can feed chunks one at a time
 * and end with the same value one call over the whole buffer gives.
 *
 * @param bytes - The data, or the next chunk of it
 * @param previous - The value the preceding chunks produced
 * @returns The unsigned 32-bit checksum
 * @example crc32(new TextEncoder().encode("123456789")) // 0xcbf43926
 * @example for (let chunk of chunks) running = crc32(chunk, running)
 */
export function crc32(bytes: Uint8Array, previous = 0): number {
	let lookup = (table ??= buildTable());
	let crc = ~previous;
	for (let byte of bytes) crc = (lookup[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
	return ~crc >>> 0;
}

/** Computes the remainder of every byte value divided by the reflected polynomial. */
function buildTable(): Uint32Array {
	let lookup = new Uint32Array(256);
	for (let index = 0; index < 256; index++) {
		let value = index;
		for (let bit = 0; bit < 8; bit++) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		lookup[index] = value >>> 0;
	}
	return lookup;
}
