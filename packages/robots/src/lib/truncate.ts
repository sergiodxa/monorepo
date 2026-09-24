/**
 * Cuts robots.txt bytes at the last line end within a parsing limit. RFC 9309 has a crawler
 * parse at least 500 KiB and lets it ignore the rest, and cutting at a line end keeps a rule
 * from being read half-written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Carriage return, one of the three line ends RFC 9309 accepts. */
const CR = 0x0d;

/** Line feed, one of the three line ends RFC 9309 accepts. */
const LF = 0x0a;

/**
 * The bytes up to and including the last line end within `maxBytes`; the whole input when it
 * already fits, and nothing when the limit holds no complete line.
 *
 * @param bytes - The file as it arrived.
 * @param maxBytes - The parsing limit.
 */
export function truncateAtLine(bytes: Uint8Array, maxBytes: number): Uint8Array {
	if (bytes.byteLength <= maxBytes) return bytes;

	for (let index = maxBytes - 1; index >= 0; index--) {
		if (bytes[index] === LF || bytes[index] === CR) return bytes.subarray(0, index + 1);
	}

	return bytes.subarray(0, 0);
}
