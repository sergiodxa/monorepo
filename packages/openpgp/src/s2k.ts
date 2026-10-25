/**
 * String-to-key specifiers (RFC 9580 §3.7): turns a passphrase into the key that locks
 * a secret key. Simple, Salted and Iterated-and-Salted run on Web Crypto digests;
 * Argon2 is read so a key using it can be named, then refused as unsupported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import type { Reader } from "./lib/bytes.js";

import { S2K_HASHES } from "./algorithms.js";
import { OpenPgpError } from "./errors.js";
import { utf8 } from "./lib/bytes.js";

/**
 * A parsed S2K specifier. Argon2 (type 4) and GnuPG's private type 101, which marks a
 * secret kept elsewhere (a smartcard or an offline primary), are kept only so they can
 * be written back.
 */
export type S2K =
	| { type: 0; hash: number }
	| { type: 1; hash: number; salt: Bytes }
	| { type: 3; hash: number; salt: Bytes; count: number }
	| { type: 4; raw: Bytes }
	| { type: 101; raw: Bytes };

/** The coded count new keys use: 16,777,216 octets hashed (`0xE0`). */
export const DEFAULT_S2K_COUNT = 0xe0;

/**
 * The octet count a coded Iterated-and-Salted count stands for (§3.7.1.3).
 *
 * @param coded - The 1-octet coded count.
 */
export function decodeCount(coded: number): number {
	return (16 + (coded & 15)) * 2 ** ((coded >> 4) + 6);
}

/**
 * Reads an S2K specifier, leaving the reader overrun for a type it cannot size.
 *
 * @param reader - Positioned at the specifier's type octet.
 */
export function readS2K(reader: Reader): S2K {
	let type = reader.u8();
	if (type === 0) return { type, hash: reader.u8() };
	if (type === 1) return { type, hash: reader.u8(), salt: Uint8Array.from(reader.take(8)) };
	if (type === 3) {
		return { type, hash: reader.u8(), salt: Uint8Array.from(reader.take(8)), count: reader.u8() };
	}
	if (type === 4) return { type, raw: Uint8Array.from(reader.take(19)) };
	if (type === 101) return { type, raw: Uint8Array.from(reader.rest()) };
	reader.overrun = true;
	return { type: 0, hash: 0 };
}

/**
 * The specifier's wire form.
 *
 * @param s2k - The specifier to write.
 */
export function writeS2K(s2k: S2K): Bytes {
	if (s2k.type === 0) return Uint8Array.of(0, s2k.hash);
	if (s2k.type === 1) return concatBytes(Uint8Array.of(1, s2k.hash), s2k.salt);
	if (s2k.type === 3)
		return concatBytes(Uint8Array.of(3, s2k.hash), s2k.salt, Uint8Array.of(s2k.count));
	return concatBytes(Uint8Array.of(s2k.type), s2k.raw);
}

/**
 * The octets one hash context digests: the salt and passphrase, repeated to the coded
 * count for an iterated specifier but never shorter than one full copy.
 *
 * @param s2k - The specifier.
 * @param passphrase - The passphrase's UTF-8 octets.
 */
function hashInput(s2k: Exclude<S2K, { type: 4 } | { type: 101 }>, passphrase: Bytes): Bytes {
	if (s2k.type === 0) return passphrase;
	let unit = concatBytes(s2k.salt, passphrase);
	if (s2k.type === 1) return unit;

	let total = Math.max(decodeCount(s2k.count), unit.length);
	let input = new Uint8Array(total);
	for (let offset = 0; offset < total; offset += unit.length) {
		input.set(unit.subarray(0, Math.min(unit.length, total - offset)), offset);
	}
	return input;
}

/**
 * Derives `size` key octets from a passphrase. When the hash is shorter than the key,
 * each further context is preloaded with one more zero octet and the digests are
 * concatenated (§3.7.1.1). An iterated specifier allocates its full octet count.
 *
 * @param s2k - The specifier from the key.
 * @param passphrase - The passphrase.
 * @param size - The key length the cipher needs.
 */
export async function deriveKey(
	s2k: S2K,
	passphrase: string,
	size: number,
): Promise<Result<Bytes, OpenPgpError>> {
	if (s2k.type === 4 || s2k.type === 101) {
		let message =
			s2k.type === 4
				? "Argon2 S2K is not available in Web Crypto."
				: "The secret key material is stored outside this key (GnuPG stub).";
		return failure(new OpenPgpError("unsupported", message));
	}
	let hash = S2K_HASHES[s2k.hash];
	if (hash === undefined) {
		return failure(
			new OpenPgpError("unsupported", `S2K hash algorithm ${s2k.hash} is not supported.`),
		);
	}

	let input = hashInput(s2k, utf8(passphrase));
	let digests: Uint8Array[] = [];
	let length = 0;
	for (let preload = 0; length < size; preload++) {
		let digest = new Uint8Array(
			await crypto.subtle.digest(hash, concatBytes(new Uint8Array(preload), input)),
		);
		digests.push(digest);
		length += digest.length;
	}
	return success(concatBytes(...digests).slice(0, size));
}
