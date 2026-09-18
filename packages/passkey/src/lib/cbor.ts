/**
 * A CBOR reader covering the subset WebAuthn puts on the wire.
 *
 * Attestation objects and COSE keys are the only CBOR this package meets, and
 * both are canonical definite-length data, so the reader rejects indefinite
 * lengths and tags outright rather than growing a general decoder.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { MalformedResponseError } from "../errors.js";

/** Bits of the initial byte that carry the major type. */
const MAJOR_TYPE_SHIFT = 5;

/** Bits of the initial byte that carry the argument. */
const ARGUMENT_MASK = 0x1f;

/** Arguments at or above this value name a following byte count instead of a value. */
const ARGUMENT_INLINE_MAX = 24;

/** Argument reserved for indefinite-length items, which canonical CBOR never emits. */
const ARGUMENT_INDEFINITE = 31;

/** Largest item length accepted, which no WebAuthn structure comes near. */
const MAX_ITEM_LENGTH = 1 << 24;

/** Values a CBOR item decodes to, limited to what WebAuthn structures contain. */
export type CborValue =
	| number
	| bigint
	| string
	| Bytes
	| boolean
	| null
	| undefined
	| CborValue[]
	| Map<CborValue, CborValue>;

/**
 * Thrown by the recursive reader and caught at the exported boundary, so the
 * traversal reads as plain code while callers still get a `Result`.
 */
class CborSyntaxError extends Error {}

/** Position-carrying reader over one CBOR payload. */
class Reader {
	/** Offset of the next byte to read. */
	offset = 0;

	constructor(private bytes: Bytes) {}

	/**
	 * Reads `count` bytes, advancing past them.
	 *
	 * @param count Number of bytes to take.
	 * @returns A view over the payload, sharing its memory.
	 */
	take(count: number): Bytes {
		if (count > MAX_ITEM_LENGTH) throw new CborSyntaxError("item too large");
		let end = this.offset + count;
		if (end > this.bytes.length) throw new CborSyntaxError("truncated item");
		let slice = this.bytes.subarray(this.offset, end);
		this.offset = end;
		return slice;
	}

	/**
	 * Reads a big-endian unsigned integer of `size` bytes.
	 *
	 * @param size Byte width, one of 1, 2, 4 or 8.
	 * @returns The value, as a `bigint` only when eight bytes exceed the safe range.
	 */
	uint(size: number): number | bigint {
		let bytes = this.take(size);
		if (size < 8) {
			let value = 0;
			for (let byte of bytes) value = value * 0x100 + byte;
			return value;
		}
		let value = 0n;
		for (let byte of bytes) value = (value << 8n) | BigInt(byte);
		return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
	}

	/**
	 * Reads the argument an initial byte introduces.
	 *
	 * @param argument Low five bits of the initial byte.
	 * @returns The argument's value.
	 */
	argument(argument: number): number | bigint {
		if (argument < ARGUMENT_INLINE_MAX) return argument;
		if (argument === ARGUMENT_INDEFINITE) throw new CborSyntaxError("indefinite length");
		if (argument > 27) throw new CborSyntaxError("reserved argument");
		return this.uint(1 << (argument - ARGUMENT_INLINE_MAX));
	}

	/**
	 * Reads one data item and everything nested inside it.
	 *
	 * @returns The decoded item.
	 */
	item(): CborValue {
		let initial = this.take(1)[0] as number;
		let major = initial >> MAJOR_TYPE_SHIFT;
		let argument = this.argument(initial & ARGUMENT_MASK);

		if (major === 0) return argument;
		if (major === 1) {
			return typeof argument === "bigint" ? -1n - argument : -1 - argument;
		}
		if (major === 2) return this.take(this.length(argument));
		if (major === 3) return new TextDecoder().decode(this.take(this.length(argument)));
		if (major === 4) {
			let count = this.length(argument);
			let items: CborValue[] = [];
			for (let index = 0; index < count; index++) items.push(this.item());
			return items;
		}
		if (major === 5) {
			let count = this.length(argument);
			let entries = new Map<CborValue, CborValue>();
			for (let index = 0; index < count; index++) entries.set(this.item(), this.item());
			return entries;
		}
		if (major === 7) return this.simple(initial & ARGUMENT_MASK, argument);

		throw new CborSyntaxError("unsupported major type");
	}

	/**
	 * Narrows an argument used as a length, which a `bigint` can never be here.
	 *
	 * @param argument Argument read from the initial byte.
	 * @returns The length as a number.
	 */
	private length(argument: number | bigint): number {
		if (typeof argument === "bigint") throw new CborSyntaxError("item too large");
		if (argument > MAX_ITEM_LENGTH) throw new CborSyntaxError("item too large");
		return argument;
	}

	/**
	 * Reads a major type 7 item: the three simple values and the float widths.
	 *
	 * @param info Low five bits of the initial byte.
	 * @param argument Argument already read for that byte.
	 * @returns The simple value or float.
	 */
	private simple(info: number, argument: number | bigint): CborValue {
		if (info === 20) return false;
		if (info === 21) return true;
		if (info === 22) return null;
		if (info === 23) return undefined;
		if (info === 25) return readFloat16(Number(argument));
		if (info === 26) return new DataView(Uint32Array.of(Number(argument)).buffer).getFloat32(0);
		if (info === 27) {
			let view = new DataView(new ArrayBuffer(8));
			view.setBigUint64(0, BigInt(argument));
			return view.getFloat64(0);
		}
		throw new CborSyntaxError("unsupported simple value");
	}
}

/**
 * Expands an IEEE 754 half-precision bit pattern into a double.
 *
 * @param bits The sixteen bits as an integer.
 * @returns The value they encode.
 */
function readFloat16(bits: number): number {
	let sign = bits & 0x8000 ? -1 : 1;
	let exponent = (bits >> 10) & 0x1f;
	let fraction = bits & 0x3ff;
	if (exponent === 0) return sign * 2 ** -24 * fraction;
	if (exponent === 0x1f) return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY;
	return sign * 2 ** (exponent - 25) * (0x400 + fraction);
}

/**
 * Decodes the first CBOR item in a payload, ignoring anything after it.
 *
 * Authenticator data appends the credential public key to a fixed prefix with
 * no length in front of it, so the item's own encoding is what says where it
 * ends; `read` reports that offset for the caller to continue from.
 *
 * @param bytes Payload whose first item to decode.
 * @returns The item and the offset just past it, or `MalformedResponseError`.
 * @example
 * let key = read(authData.subarray(55));
 */
export function read(bytes: Bytes): Result<[CborValue, number], MalformedResponseError> {
	let reader = new Reader(bytes);
	try {
		let value = reader.item();
		return success([value, reader.offset]);
	} catch {
		return failure(new MalformedResponseError("unreadable CBOR"));
	}
}

/**
 * Decodes a payload that must be exactly one CBOR item.
 *
 * @param bytes Payload to decode in full.
 * @returns The item, or `MalformedResponseError` when bytes follow it.
 * @example
 * let attestation = decode(attestationObject);
 */
export function decode(bytes: Bytes): Result<CborValue, MalformedResponseError> {
	let result = read(bytes);
	if (isFailure(result)) return result;
	let [value, offset] = result.data;
	if (offset !== bytes.length) return failure(new MalformedResponseError("trailing CBOR bytes"));
	return success(value);
}
