/**
 * Decodes CBOR (RFC 8949) into JavaScript values, refusing anything not well-formed and bounding
 * nesting depth and item count so a hostile document costs at most what the caller allows.
 * With `deterministic`, it also refuses any encoding §4.2.1's core requirements rule out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { CBORValue } from "./values.js";

import { encode } from "./encode.js";
import { CBORError } from "./errors.js";
import { compareBytes, latin1 } from "./lib/bytes.js";
import { CANONICAL_NAN_BITS, floatWidth, readFloat16 } from "./lib/float.js";
import { Simple, Tagged } from "./values.js";

/** Nesting depth allowed when the caller sets none; far beyond any protocol built on CBOR. */
const DEFAULT_MAX_DEPTH = 64;

/** Data items allowed when the caller sets none, bounding what one small input can allocate. */
const DEFAULT_MAX_ITEMS = 100_000;

/** The "break" stop code ending an indefinite-length item. */
const BREAK = 0xff;

/** Smallest argument each of the 1, 2, 4 and 8 byte widths may carry under preferred serialization. */
const MINIMUM_ARGUMENT = [24, 0x100, 0x10000, 0x100000000];

/** The bignum tags: an unsigned and a negative integer held in a byte string. */
const TAG = { positiveBignum: 2, negativeBignum: 3 };

/** Strict UTF-8, so a text string with invalid bytes fails instead of decoding to U+FFFD. */
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** Limits and strictness one decode runs under. */
export interface DecodeOptions {
	/**
	 * Deepest nesting of arrays, maps and tags accepted; a deeper item fails `limit-exceeded`.
	 *
	 * @default 64
	 */
	maxDepth?: number;
	/**
	 * Most data items accepted, nested ones included; one more fails `limit-exceeded`.
	 *
	 * @default 100000
	 */
	maxItems?: number;
	/**
	 * Refuse encodings deterministic CBOR rules out — a longer argument than needed, an
	 * indefinite length, a float wider than its value needs, unsorted map keys, a bignum
	 * that fits in 64 bits — with `not-deterministic`.
	 *
	 * @default false
	 */
	deterministic?: boolean;
}

/** The first data item of a longer input, and how many bytes it occupied. */
export interface DecodedPrefix {
	value: CBORValue;
	/** Bytes the item's encoding took, so the caller can read what follows it. */
	length: number;
}

/** An initial byte and the argument it introduces. */
interface Head {
	major: number;
	info: number;
	/** The argument, or `undefined` for an indefinite length or a break. */
	argument: number | bigint | undefined;
}

/**
 * Raised by the recursive reader and caught at the exported boundary, so the traversal reads as
 * plain code while callers still receive a `Result`.
 */
class DecodeFailure extends Error {
	/** @param error The failure the exported functions return. */
	constructor(readonly error: CBORError) {
		super(error.message);
	}
}

/** Position-carrying reader over one input, counting items and checking every limit. */
class Reader {
	/** Offset of the next byte to read. */
	offset = 0;

	/** Data items read so far. */
	private items = 0;

	private maxDepth: number;
	private maxItems: number;
	private deterministic: boolean;

	/**
	 * @param bytes The input.
	 * @param options Limits and strictness.
	 */
	constructor(
		private bytes: Uint8Array,
		options: DecodeOptions,
	) {
		this.maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
		this.maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
		this.deterministic = options.deterministic ?? false;
	}

	/**
	 * Stops decoding with a failure.
	 *
	 * @param code What went wrong.
	 * @param message The failure in words.
	 * @param offset Where the failing item starts.
	 */
	fail(code: CBORError["code"], message: string, offset: number): never {
		throw new DecodeFailure(new CBORError(code, message, offset));
	}

	/**
	 * Takes `count` bytes, advancing past them.
	 *
	 * @param count Bytes to take.
	 * @param start Offset of the item they belong to, for the failure.
	 * @returns A view over the input.
	 */
	take(count: number, start: number): Uint8Array {
		let end = this.offset + count;
		if (end > this.bytes.length) this.fail("truncated", "input ends inside an item", start);
		let slice = this.bytes.subarray(this.offset, end);
		this.offset = end;
		return slice;
	}

	/**
	 * Whether the next byte is the break code, consuming it when it is.
	 *
	 * @param start Offset of the indefinite-length item being read, for the failure.
	 */
	atBreak(start: number): boolean {
		if (this.offset >= this.bytes.length) {
			this.fail("truncated", "input ends inside an indefinite-length item", start);
		}
		if (this.bytes[this.offset] !== BREAK) return false;
		this.offset += 1;
		return true;
	}

	/**
	 * Reads an initial byte and its argument.
	 *
	 * @param start Offset of the item, for failures.
	 * @returns The major type, the additional information and the argument.
	 */
	head(start: number): Head {
		let initial = this.take(1, start)[0] as number;
		let major = initial >> 5;
		let info = initial & 0x1f;
		if (info < 24) return { major, info, argument: info };
		if (info === 31) {
			if (major === 0 || major === 1 || major === 6) {
				this.fail("malformed", "indefinite length on a type that has none", start);
			}
			if (this.deterministic && major !== 7) {
				this.fail("not-deterministic", "indefinite length", start);
			}
			return { major, info, argument: undefined };
		}
		if (info > 27) this.fail("malformed", "reserved additional information", start);

		let width = 1 << (info - 24);
		let bytes = this.take(width, start);
		let argument: number | bigint = 0;
		if (width < 8) {
			for (let byte of bytes) argument = argument * 0x100 + byte;
		} else {
			let wide = 0n;
			for (let byte of bytes) wide = (wide << 8n) | BigInt(byte);
			argument = wide <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(wide) : wide;
		}

		if (this.deterministic && major !== 7 && argument < (MINIMUM_ARGUMENT[info - 24] as number)) {
			this.fail("not-deterministic", "argument longer than its value needs", start);
		}
		return { major, info, argument };
	}

	/**
	 * Reads one data item and everything nested in it.
	 *
	 * @param depth How many arrays, maps and tags enclose the item.
	 * @returns The decoded value.
	 */
	item(depth: number): CBORValue {
		let start = this.offset;
		if (depth > this.maxDepth) this.fail("limit-exceeded", "nesting deeper than maxDepth", start);
		this.items += 1;
		if (this.items > this.maxItems) this.fail("limit-exceeded", "more items than maxItems", start);

		let head = this.head(start);
		let { major, argument } = head;

		if (major === 0) return argument as number | bigint;
		if (major === 1) return negative(argument as number | bigint);
		if (major === 2) return this.string(head, start).slice();
		if (major === 3) return this.text(this.string(head, start), start);
		if (major === 4) return this.array(argument, depth, start);
		if (major === 5) return this.map(argument, depth, start);
		if (major === 6) return this.tag(argument as number | bigint, depth, start);
		return this.simple(head, start);
	}

	/**
	 * Narrows an argument used as a length, failing when the input cannot hold it.
	 *
	 * @param argument The argument.
	 * @param unit Fewest bytes each counted element takes.
	 * @param start Offset of the item, for the failure.
	 */
	length(argument: number | bigint, unit: number, start: number): number {
		let remaining = this.bytes.length - this.offset;
		if (typeof argument === "bigint" || argument * unit > remaining) {
			this.fail("truncated", "length runs past the end of the input", start);
		}
		return argument;
	}

	/**
	 * Reads a byte or text string's bytes, joining the chunks of an indefinite-length one.
	 *
	 * @param head The string's head.
	 * @param start Offset of the item, for failures.
	 */
	string(head: Head, start: number): Uint8Array {
		if (head.argument !== undefined) return this.take(this.length(head.argument, 1, start), start);

		let chunks: Uint8Array[] = [];
		let total = 0;
		while (!this.atBreak(start)) {
			let chunkStart = this.offset;
			let chunk = this.head(chunkStart);
			if (chunk.major !== head.major || chunk.argument === undefined) {
				this.fail("malformed", "indefinite-length string chunk of another type", chunkStart);
			}
			let bytes = this.take(this.length(chunk.argument, 1, chunkStart), chunkStart);
			if (head.major === 3) this.text(bytes, chunkStart);
			chunks.push(bytes);
			total += bytes.length;
		}

		let joined = new Uint8Array(total);
		let position = 0;
		for (let chunk of chunks) {
			joined.set(chunk, position);
			position += chunk.length;
		}
		return joined;
	}

	/**
	 * Decodes a text string's bytes as strict UTF-8.
	 *
	 * @param bytes The string's bytes.
	 * @param start Offset of the item, for the failure.
	 */
	text(bytes: Uint8Array, start: number): string {
		try {
			return UTF8.decode(bytes);
		} catch {
			return this.fail("malformed", "text string is not valid UTF-8", start);
		}
	}

	/**
	 * Reads an array's elements.
	 *
	 * @param argument Element count, or `undefined` for an indefinite length.
	 * @param depth Depth of the array itself.
	 * @param start Offset of the item, for failures.
	 */
	array(argument: number | bigint | undefined, depth: number, start: number): CBORValue[] {
		let values: CBORValue[] = [];
		if (argument === undefined) {
			while (!this.atBreak(start)) values.push(this.item(depth + 1));
			return values;
		}
		let count = this.length(argument, 1, start);
		for (let index = 0; index < count; index++) values.push(this.item(depth + 1));
		return values;
	}

	/**
	 * Reads a map's entries, refusing a key equal to an earlier one and, when deterministic,
	 * a key that does not sort after the one before it.
	 *
	 * @param argument Entry count, or `undefined` for an indefinite length.
	 * @param depth Depth of the map itself.
	 * @param start Offset of the item, for failures.
	 */
	map(
		argument: number | bigint | undefined,
		depth: number,
		start: number,
	): Map<CBORValue, CBORValue> {
		let entries = new Map<CBORValue, CBORValue>();
		let seen = new Set<string>();
		let previous: Uint8Array | undefined;
		let count = argument === undefined ? Infinity : this.length(argument, 2, start);

		for (let index = 0; index < count; index++) {
			if (argument === undefined && this.atBreak(start)) break;
			let keyStart = this.offset;
			let key = this.item(depth + 1);
			let raw = this.bytes.subarray(keyStart, this.offset);

			if (this.deterministic && previous && compareBytes(previous, raw) >= 0) {
				this.fail("not-deterministic", "map keys out of order", keyStart);
			}
			previous = raw;

			let identity = encode(key);
			let id = isFailure(identity) ? latin1(raw) : latin1(identity.data);
			if (seen.has(id)) this.fail("duplicate-key", "map key repeats", keyStart);
			seen.add(id);
			entries.set(key, this.item(depth + 1));
		}
		return entries;
	}

	/**
	 * Reads a tagged item, turning the bignum tags into `bigint`.
	 *
	 * @param tag The tag number.
	 * @param depth Depth of the tag itself.
	 * @param start Offset of the item, for failures.
	 */
	tag(tag: number | bigint, depth: number, start: number): CBORValue {
		let value = this.item(depth + 1);
		if (tag !== TAG.positiveBignum && tag !== TAG.negativeBignum) return new Tagged(tag, value);
		if (!(value instanceof Uint8Array))
			this.fail("malformed", "bignum is not a byte string", start);

		let magnitude = 0n;
		for (let byte of value) magnitude = (magnitude << 8n) | BigInt(byte);
		if (this.deterministic && (value[0] === 0 || magnitude <= 0xffffffffffffffffn)) {
			this.fail("not-deterministic", "bignum with a shorter encoding", start);
		}
		return tag === TAG.positiveBignum ? magnitude : -1n - magnitude;
	}

	/**
	 * Reads a major type 7 item: a simple value or a float.
	 *
	 * @param head The item's head.
	 * @param start Offset of the item, for failures.
	 */
	simple({ info, argument }: Head, start: number): CBORValue {
		if (info === 20) return false;
		if (info === 21) return true;
		if (info === 22) return null;
		if (info === 23) return undefined;
		if (info < 20) return new Simple(info);
		if (info === 31)
			return this.fail("malformed", "break outside an indefinite-length item", start);
		if (info === 24) {
			if ((argument as number) < 32) this.fail("malformed", "simple value in two bytes", start);
			return new Simple(argument as number);
		}

		let view = new DataView(new ArrayBuffer(8));
		view.setBigUint64(0, BigInt(argument as number | bigint));
		let value = readFloat(view, info);

		if (this.deterministic) {
			let width = 1 << (info - 24);
			let preferred = Number.isNaN(value)
				? width === 2 && argument === CANONICAL_NAN_BITS
				: floatWidth(value) === width;
			if (!preferred) this.fail("not-deterministic", "float wider than its value needs", start);
		}
		return value;
	}
}

/**
 * Reads the float a major type 7 argument holds, right-aligned in an eight-byte view.
 *
 * @param view The argument's bytes.
 * @param info 25, 26 or 27 for half, single or double precision.
 */
function readFloat(view: DataView, info: number): number {
	if (info === 25) return readFloat16(view.getUint16(6));
	if (info === 26) return view.getFloat32(4);
	return view.getFloat64(0);
}

/**
 * The negative integer a major type 1 argument encodes, as a `bigint` beyond the safe range.
 *
 * @param argument The argument `n` of the integer `-1 - n`.
 */
function negative(argument: number | bigint): number | bigint {
	if (typeof argument === "bigint" || argument >= Number.MAX_SAFE_INTEGER) {
		return -1n - BigInt(argument);
	}
	return -1 - argument;
}

/**
 * Runs the reader over `bytes`, converting a raised failure into a `Result`.
 *
 * @param bytes The input.
 * @param options Limits and strictness.
 */
function run(bytes: Uint8Array, options: DecodeOptions): Result<DecodedPrefix, CBORError> {
	let reader = new Reader(bytes, options);
	try {
		let value = reader.item(0);
		return success({ value, length: reader.offset });
	} catch (error) {
		if (error instanceof DecodeFailure) return failure(error.error);
		throw error;
	}
}

/**
 * Decodes an input that holds exactly one CBOR data item.
 *
 * @param bytes The encoded item.
 * @param options Limits and strictness.
 * @returns The value, or a `CBORError` saying what is wrong and at which byte.
 * @example
 * let value = decode(Uint8Array.of(0x83, 0x01, 0x02, 0x03)); // success([1, 2, 3])
 */
export function decode(
	bytes: Uint8Array,
	options: DecodeOptions = {},
): Result<CBORValue, CBORError> {
	let result = run(bytes, options);
	if (isFailure(result)) return result;
	if (result.data.length !== bytes.length) {
		return failure(new CBORError("trailing-bytes", "bytes follow the item", result.data.length));
	}
	return success(result.data.value);
}

/**
 * Decodes the first CBOR data item of an input and reports where it ends, for formats that
 * place an item before other data with no length in front of it.
 *
 * @param bytes Input starting with an encoded item.
 * @param options Limits and strictness.
 * @returns The value and the bytes it occupied, or a `CBORError`.
 * @example
 * let { value, length } = unwrap(decodeFirst(bytes)); // bytes.subarray(length) is what follows
 */
export function decodeFirst(
	bytes: Uint8Array,
	options: DecodeOptions = {},
): Result<DecodedPrefix, CBORError> {
	return run(bytes, options);
}
