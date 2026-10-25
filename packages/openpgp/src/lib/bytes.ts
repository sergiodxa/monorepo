/**
 * The octet-level vocabulary every OpenPGP structure is written in: big-endian scalars,
 * multiprecision integers and a bounds-checked reader, so a truncated packet surfaces
 * as one `overrun` flag instead of an exception halfway through a parser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";

import { concatBytes } from "@sdxc/crypto";

/** Shared UTF-8 encoder, so text hashes to the same octets everywhere it is signed. */
const ENCODER = new TextEncoder();

/** Shared UTF-8 decoder for User IDs and other packet text. */
const DECODER = new TextDecoder();

/**
 * Reads big-endian fields from a byte range. Reading past the end sets `overrun` and
 * answers zeros, so a parser checks the flag once before trusting what it read.
 */
export class Reader {
	/** The bytes being read. */
	readonly bytes: Bytes;

	/** Where the next read starts. */
	offset = 0;

	/** Whether any read asked for more octets than remained. */
	overrun = false;

	/** @param bytes - The range to read. */
	constructor(bytes: Bytes) {
		this.bytes = bytes;
	}

	/** Octets left to read. */
	get remaining(): number {
		return this.bytes.length - this.offset;
	}

	/**
	 * The next `length` octets, or an empty view once the range is exhausted.
	 *
	 * @param length - How many octets to take.
	 */
	take(length: number): Bytes {
		if (length < 0 || length > this.remaining) {
			this.overrun = true;
			this.offset = this.bytes.length;
			return new Uint8Array(0);
		}
		let slice = this.bytes.subarray(this.offset, this.offset + length);
		this.offset += length;
		return slice;
	}

	/** Everything left in the range. */
	rest(): Bytes {
		return this.take(this.remaining);
	}

	/** A 1-octet scalar. */
	u8(): number {
		return this.take(1)[0] ?? 0;
	}

	/** A 2-octet big-endian scalar. */
	u16(): number {
		let bytes = this.take(2);
		return ((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0);
	}

	/** A 4-octet big-endian scalar, unsigned. */
	u32(): number {
		return readU32(this.take(4));
	}

	/**
	 * A multiprecision integer's magnitude (RFC 9580 §3.2), its bit count dropped. In
	 * `strict` mode, which a version 6 packet requires, a count that disagrees with the
	 * magnitude's most significant bit marks the reader as overrun.
	 *
	 * @param strict - Whether the bit count must match the magnitude exactly.
	 */
	mpi(strict = false): Bytes {
		let bits = this.u16();
		let value = this.take(Math.ceil(bits / 8));
		if (strict && bitLength(value) !== bits) this.overrun = true;
		return value;
	}
}

/**
 * A 4-octet big-endian scalar from exactly four octets.
 *
 * @param bytes - The octets, most significant first.
 */
function readU32(bytes: Uint8Array): number {
	return (
		(bytes[0] ?? 0) * 0x1000000 + ((bytes[1] ?? 0) << 16) + ((bytes[2] ?? 0) << 8) + (bytes[3] ?? 0)
	);
}

/**
 * The number of significant bits in a big-endian magnitude, the count an MPI header carries.
 *
 * @param value - The magnitude, most significant octet first.
 */
export function bitLength(value: Uint8Array): number {
	let index = value.findIndex((byte) => byte !== 0);
	if (index === -1) return 0;
	let first = value[index] ?? 0;
	return (value.length - index - 1) * 8 + (32 - Math.clz32(first));
}

/**
 * A magnitude with its leading zero octets removed, the form an MPI carries.
 *
 * @param value - The magnitude, most significant octet first.
 */
export function stripLeadingZeros(value: Uint8Array): Bytes {
	let index = value.findIndex((byte) => byte !== 0);
	return Uint8Array.from(index === -1 ? [] : value.subarray(index));
}

/**
 * An MPI: the bit count, then the magnitude without leading zero octets.
 *
 * @param value - The magnitude, most significant octet first.
 */
export function mpi(value: Uint8Array): Bytes {
	let magnitude = stripLeadingZeros(value);
	return concatBytes(u16(bitLength(magnitude)), magnitude);
}

/**
 * A magnitude left-padded with zero octets to `length`, the fixed width Web Crypto
 * expects for a curve coordinate or scalar an MPI shortened.
 *
 * @param value - The magnitude, most significant octet first.
 * @param length - The width to pad to.
 */
export function padStart(value: Uint8Array, length: number): Bytes {
	let padded = new Uint8Array(Math.max(length, value.length));
	padded.set(value, padded.length - value.length);
	return padded;
}

/**
 * A 2-octet big-endian scalar.
 *
 * @param value - A number below 65536.
 */
export function u16(value: number): Bytes {
	return Uint8Array.of((value >>> 8) & 0xff, value & 0xff);
}

/**
 * A 4-octet big-endian scalar, the value taken modulo 2^32.
 *
 * @param value - A non-negative integer.
 */
export function u32(value: number): Bytes {
	return Uint8Array.of(
		(value >>> 24) & 0xff,
		(value >>> 16) & 0xff,
		(value >>> 8) & 0xff,
		value & 0xff,
	);
}

/**
 * A time field (RFC 9580 §3.5): whole seconds since the Unix epoch.
 *
 * @param date - The moment, truncated to the second.
 */
export function timeField(date: Date): Bytes {
	return u32(Math.floor(date.getTime() / 1000));
}

/**
 * Text as UTF-8 octets.
 *
 * @param text - The text to encode.
 */
export function utf8(text: string): Bytes {
	return ENCODER.encode(text);
}

/**
 * UTF-8 octets as text, with the replacement character for an invalid sequence.
 *
 * @param bytes - The octets to decode.
 */
export function readUtf8(bytes: Uint8Array): string {
	return DECODER.decode(bytes);
}

/**
 * Whether two byte strings hold the same octets.
 *
 * @param left - One string.
 * @param right - The other.
 */
export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
	return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

/**
 * Uppercase hex, the form OpenPGP tools print fingerprints and Key IDs in.
 *
 * @param bytes - The octets to print.
 */
export function upperHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase();
}

/**
 * A copy of the bytes in a fresh `ArrayBuffer`, the form Web Crypto accepts from any view.
 *
 * @param bytes - The octets to copy.
 */
export function toBytes(bytes: Uint8Array): Bytes {
	return Uint8Array.from(bytes);
}

/**
 * The bytes a big-endian magnitude spells as a `bigint`, for the RSA arithmetic Web
 * Crypto's JWK import needs.
 *
 * @param bytes - The magnitude, most significant octet first.
 */
export function toBigInt(bytes: Uint8Array): bigint {
	let value = 0n;
	for (let byte of bytes) value = (value << 8n) | BigInt(byte);
	return value;
}

/**
 * A non-negative `bigint` as its shortest big-endian magnitude.
 *
 * @param value - The integer to write.
 */
export function fromBigInt(value: bigint): Bytes {
	let hex = value.toString(16);
	if (hex.length % 2 === 1) hex = `0${hex}`;
	let bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}
