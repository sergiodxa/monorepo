/**
 * Base64 for Byte Sequences over the platform's `atob` and `btoa`, which every runtime the
 * package targets provides. Decoding follows the forgiving base64 algorithm, so missing
 * padding and nonzero pad bits are accepted, as RFC 9651 section 4.2.7 asks of parsers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Bytes converted per `String.fromCharCode` call, well under engines' argument limits. */
const CHUNK_SIZE = 0x8000;

/**
 * Encodes bytes as padded standard base64, the canonical form RFC 9651 serializes.
 *
 * @param bytes - The Byte Sequence
 * @returns Its base64 text
 */
export function encodeBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
	}
	return btoa(binary);
}

/**
 * Decodes standard base64 text whose characters the caller already restricted to the
 * base64 alphabet and `=`.
 *
 * @param text - The text between a Byte Sequence's colons
 * @returns The bytes, or `null` when padding sits anywhere but the end or the length
 *   leaves a lone trailing character
 */
export function decodeBase64(text: string): Uint8Array | null {
	let binary: string;
	try {
		binary = atob(text);
	} catch {
		return null;
	}
	let bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}
