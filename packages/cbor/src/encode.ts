/**
 * Encodes JavaScript values as deterministic CBOR (RFC 8949 §4.2.1): shortest arguments and
 * floats, definite lengths only, and map keys sorted by their encoded bytes, so equal values
 * always produce identical bytes and can be hashed or signed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { CBORValue } from "./values.js";

import { CBORError } from "./errors.js";
import { compareBytes } from "./lib/bytes.js";
import { floatWidth, toFloat16 } from "./lib/float.js";
import { Simple, Tagged } from "./values.js";

/** Largest argument CBOR's eight-byte width carries; integers beyond it become bignums. */
const MAX_ARGUMENT = 0xffffffffffffffffn;

/** Matches a UTF-16 surrogate without its pair, which UTF-8 cannot represent. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Encoder for text strings, shared across calls. */
const UTF8 = new TextEncoder();

/**
 * Raised inside the recursive writer and caught at `encode`, so callers receive a `Result`.
 */
class EncodeFailure extends Error {
	/** @param error The failure `encode` returns. */
	constructor(readonly error: CBORError) {
		super(error.message);
	}
}

/**
 * Stops encoding with a failure.
 *
 * @param code What went wrong.
 * @param message The failure in words.
 */
function fail(code: CBORError["code"], message: string): never {
	throw new EncodeFailure(new CBORError(code, message));
}

/**
 * Writes an initial byte and its argument in the fewest bytes that hold it.
 *
 * @param parts Output chunks to append to.
 * @param major Major type, 0 to 7.
 * @param argument A non-negative integer up to 2^64 - 1.
 */
function head(parts: Uint8Array[], major: number, argument: number | bigint): void {
	let type = major << 5;
	let value = BigInt(argument);
	if (value < 24n) return void parts.push(Uint8Array.of(type | Number(value)));
	if (value < 0x100n) return void parts.push(Uint8Array.of(type | 24, Number(value)));

	let bytes: Uint8Array<ArrayBuffer>;
	if (value < 0x10000n) {
		bytes = new Uint8Array(3);
		new DataView(bytes.buffer).setUint16(1, Number(value));
		bytes[0] = type | 25;
	} else if (value < 0x100000000n) {
		bytes = new Uint8Array(5);
		new DataView(bytes.buffer).setUint32(1, Number(value));
		bytes[0] = type | 26;
	} else {
		bytes = new Uint8Array(9);
		new DataView(bytes.buffer).setBigUint64(1, value);
		bytes[0] = type | 27;
	}
	parts.push(bytes);
}

/**
 * Writes a number: an integer as major type 0 or 1, anything else as the shortest float that
 * holds it exactly. `-0` stays a float, so it keeps its sign.
 *
 * @param parts Output chunks to append to.
 * @param value The number.
 */
function number(parts: Uint8Array[], value: number): void {
	if (Number.isSafeInteger(value) && !Object.is(value, -0)) {
		return value < 0 ? head(parts, 1, -1 - value) : head(parts, 0, value);
	}
	let width = floatWidth(value);
	let bytes = new Uint8Array(1 + width);
	let view = new DataView(bytes.buffer);
	if (width === 2) {
		bytes[0] = 0xf9;
		view.setUint16(1, toFloat16(value) as number);
	} else if (width === 4) {
		bytes[0] = 0xfa;
		view.setFloat32(1, value);
	} else {
		bytes[0] = 0xfb;
		view.setFloat64(1, value);
	}
	parts.push(bytes);
}

/**
 * Writes a `bigint` as a plain integer when it fits in 64 bits, else as a bignum (tag 2 or 3)
 * with no leading zero bytes.
 *
 * @param parts Output chunks to append to.
 * @param value The integer.
 */
function bigint(parts: Uint8Array[], value: bigint): void {
	let negative = value < 0n;
	let magnitude = negative ? -1n - value : value;
	if (magnitude <= MAX_ARGUMENT) return head(parts, negative ? 1 : 0, magnitude);

	let hex = magnitude.toString(16);
	if (hex.length % 2 === 1) hex = `0${hex}`;
	let bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	head(parts, 6, negative ? 3 : 2);
	head(parts, 2, bytes.length);
	parts.push(bytes);
}

/**
 * Joins output chunks into one array.
 *
 * @param parts The chunks, in order.
 */
function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	let total = 0;
	for (let part of parts) total += part.length;
	let bytes = new Uint8Array(total);
	let offset = 0;
	for (let part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return bytes;
}

/**
 * Writes a map with its entries sorted by the bytes of their encoded keys.
 *
 * @param parts Output chunks to append to.
 * @param map The map.
 * @param ancestors Containers being written around this one, to detect a cycle.
 */
function map(parts: Uint8Array[], map: Map<CBORValue, CBORValue>, ancestors: Set<object>): void {
	let entries: [Uint8Array, Uint8Array][] = [];
	for (let [key, value] of map) {
		let keyParts: Uint8Array[] = [];
		let valueParts: Uint8Array[] = [];
		item(keyParts, key, ancestors);
		item(valueParts, value, ancestors);
		entries.push([concat(keyParts), concat(valueParts)]);
	}
	entries.sort(([left], [right]) => compareBytes(left, right));
	for (let index = 1; index < entries.length; index++) {
		if (compareBytes(entries[index - 1]![0], entries[index]![0]) === 0) {
			fail("duplicate-key", "two map keys encode to the same bytes");
		}
	}
	head(parts, 5, entries.length);
	for (let [key, value] of entries) parts.push(key, value);
}

/**
 * Writes one value and everything nested in it.
 *
 * @param parts Output chunks to append to.
 * @param value The value.
 * @param ancestors Containers being written around this one, to detect a cycle.
 */
function item(parts: Uint8Array[], value: CBORValue, ancestors: Set<object>): void {
	if (value === undefined) return void parts.push(Uint8Array.of(0xf7));
	if (value === null) return void parts.push(Uint8Array.of(0xf6));
	if (value === false) return void parts.push(Uint8Array.of(0xf4));
	if (value === true) return void parts.push(Uint8Array.of(0xf5));
	if (typeof value === "number") return number(parts, value);
	if (typeof value === "bigint") return bigint(parts, value);

	if (typeof value === "string") {
		if (LONE_SURROGATE.test(value)) fail("unencodable", "string holds a lone surrogate");
		let bytes = UTF8.encode(value);
		head(parts, 3, bytes.length);
		return void parts.push(bytes);
	}

	if (value instanceof Uint8Array) {
		head(parts, 2, value.length);
		return void parts.push(value);
	}

	if (value instanceof Simple) {
		let simple = value.value;
		let assigned = Number.isInteger(simple) && (simple < 20 || simple >= 32) && simple <= 255;
		if (!assigned || simple < 0) fail("unencodable", `simple(${simple}) is not encodable`);
		return head(parts, 7, simple);
	}

	if (typeof value !== "object") return fail("unencodable", `${typeof value} is not a CBOR value`);
	if (ancestors.has(value)) fail("unencodable", "value contains itself");
	ancestors.add(value);

	if (Array.isArray(value)) {
		head(parts, 4, value.length);
		for (let element of value) item(parts, element, ancestors);
	} else if (value instanceof Map) {
		map(parts, value, ancestors);
	} else if (value instanceof Tagged) {
		let tag = value.tag;
		let valid =
			typeof tag === "bigint"
				? tag >= 0n && tag <= MAX_ARGUMENT
				: Number.isSafeInteger(tag) && tag >= 0;
		if (!valid) fail("unencodable", `tag ${tag} is out of range`);
		head(parts, 6, tag);
		item(parts, value.value, ancestors);
	} else {
		fail("unencodable", "only arrays, maps, Tagged and Simple encode as objects");
	}

	ancestors.delete(value);
}

/**
 * Encodes a value as deterministic CBOR.
 *
 * A safe integer becomes a CBOR integer and any other number the shortest float that holds it,
 * so `1.0` encodes as `1`. A cycle, a lone surrogate, a plain object, or two map keys with the
 * same encoding fail instead of writing invalid CBOR.
 *
 * @param value The value to encode.
 * @returns The encoded bytes, or a `CBORError` naming what could not be encoded.
 * @example
 * let bytes = encode(new Map([["a", 1]])); // success(Uint8Array [0xa1, 0x61, 0x61, 0x01])
 */
export function encode(value: CBORValue): Result<Uint8Array<ArrayBuffer>, CBORError> {
	let parts: Uint8Array[] = [];
	try {
		item(parts, value, new Set());
	} catch (error) {
		if (error instanceof EncodeFailure) return failure(error.error);
		throw error;
	}
	return success(concat(parts));
}
