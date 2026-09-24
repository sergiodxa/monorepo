/**
 * SHA-256 as lowercase hex, the one digest the fingerprint, the record id and derived
 * client keys share, so all three are fixed-length values safe to store and to send.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Hex } from "@sdxc/crypto";

/**
 * Hashes bytes with WebCrypto, which every runtime the package targets provides.
 *
 * @param data - The bytes, or text encoded as UTF-8
 * @returns 64 lowercase hex characters
 */
export async function sha256Hex(data: string | Uint8Array<ArrayBuffer>): Promise<string> {
	let bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
	return Hex.encode(await crypto.subtle.digest("SHA-256", bytes));
}

/**
 * Hashes a list of strings so that no two different lists collide by concatenation:
 * `["ab", "c"]` and `["a", "bc"]` hash differently because JSON delimits every part.
 *
 * @param parts - The strings to combine
 * @returns 64 lowercase hex characters
 */
export function sha256Parts(parts: string[]): Promise<string> {
	return sha256Hex(JSON.stringify(parts));
}
