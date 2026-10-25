/**
 * Byte helpers for the TLS-notation structures Privacy Pass sends: a cursor that reads
 * fixed and length-prefixed fields without running past the end, and the padded base64url
 * every `PrivateToken` parameter carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";

import { Base64Url } from "@sdxc/crypto";

/** Base64 encodes three bytes in four characters, so a padded value is a multiple of four. */
const QUARTET = 4;

/**
 * Encodes bytes as base64url with `=` padding, which RFC 9577 §2.1.2 requires of every
 * `challenge`, `token-key` and `token` value.
 *
 * @param bytes - The value to encode
 * @returns The padded base64url text
 */
export function toPaddedBase64Url(bytes: Uint8Array): string {
	let text = Base64Url.encode(bytes);
	return text.padEnd(Math.ceil(text.length / QUARTET) * QUARTET, "=");
}

/**
 * Reads a structure front to back. Every read answers `null` once the input runs short, so
 * a truncated structure fails where it breaks instead of reading zeros.
 */
export class Cursor {
	#bytes: Uint8Array;
	#offset = 0;

	/** @param bytes - The encoded structure */
	constructor(bytes: Uint8Array) {
		this.#bytes = bytes;
	}

	/** Whether every byte has been read, which a structure with no trailing data requires. */
	get done(): boolean {
		return this.#offset === this.#bytes.length;
	}

	/**
	 * @param length - Bytes to read
	 * @returns A copy of the next `length` bytes, or `null` when fewer remain
	 */
	bytes(length: number): Bytes | null {
		if (this.#offset + length > this.#bytes.length) return null;
		let slice = this.#bytes.slice(this.#offset, this.#offset + length);
		this.#offset += length;
		return slice;
	}

	/** @returns The next big-endian 16-bit integer, or `null` when fewer than two bytes remain */
	uint16(): number | null {
		let bytes = this.bytes(2);
		return bytes === null ? null : (bytes[0]! << 8) | bytes[1]!;
	}

	/**
	 * Reads an `opaque field<..>` whose length prefix takes `prefix` bytes.
	 *
	 * @param prefix - The width of the length prefix, one or two bytes
	 * @returns The field's contents, or `null` when the input runs short
	 */
	vector(prefix: 1 | 2): Bytes | null {
		let length = prefix === 1 ? this.bytes(1)?.[0] : this.uint16();
		if (length === undefined || length === null) return null;
		return this.bytes(length);
	}
}

/**
 * Writes a big-endian 16-bit integer.
 *
 * @param value - An integer from `0` to `0xffff`
 * @returns The two bytes
 */
export function uint16(value: number): Bytes {
	return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}
