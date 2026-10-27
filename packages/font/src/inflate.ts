/**
 * A zlib (RFC 1950) and DEFLATE (RFC 1951) decoder in plain TypeScript. WOFF compresses each
 * table with zlib, and decoding it here keeps `parseFont` synchronous on every runtime,
 * since the platform's `DecompressionStream` only answers asynchronously.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { FontError } from "./font-error.js";
import { BitReader, decodeSymbol, huffmanTable } from "./huffman.js";

/** Base length of each length symbol 257–285. */
const LENGTH_BASE = [
	3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
	163, 195, 227, 258,
];

/** Extra bits after each length symbol 257–285. */
const LENGTH_EXTRA = [
	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];

/** Base distance of each distance symbol 0–29. */
const DISTANCE_BASE = [
	1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
	3073, 4097, 6145, 8193, 12289, 16385, 24577,
];

/** Extra bits after each distance symbol 0–29. */
const DISTANCE_EXTRA = [
	0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

/** The order a dynamic block lists its code-length code lengths in. */
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** The two prefix codes of a compressed block. */
interface BlockCodes {
	literals: Int32Array;
	distances: Int32Array;
}

/**
 * Decodes a zlib stream: the two-byte header, DEFLATE data, then the Adler-32 of the output,
 * which is checked.
 *
 * @param data - The compressed bytes.
 * @param size - The exact decompressed size, known from the container.
 * @returns The decompressed bytes, or a `malformed` `FontError` when the stream is corrupt,
 *   uses a preset dictionary, or decodes to a different size.
 */
export function inflate(data: Uint8Array, size: number): Result<Uint8Array, FontError> {
	let method = data[0] ?? 0;
	let flags = data[1] ?? 0;
	if (data.length < 6 || (method & 0x0f) !== 8 || (method * 256 + flags) % 31 !== 0) {
		return corrupt("The zlib header is invalid.");
	}
	if (flags & 0x20) return corrupt("The zlib stream needs a preset dictionary.");
	let reader = new BitReader(data.subarray(2));
	let output = inflateStream(reader, size);
	if (output === null) return corrupt("The compressed data is corrupt.");
	reader.align();
	let trailer = reader.bytes(4);
	let expected =
		(((trailer[0] ?? 0) << 24) |
			((trailer[1] ?? 0) << 16) |
			((trailer[2] ?? 0) << 8) |
			(trailer[3] ?? 0)) >>>
		0;
	if (trailer.length < 4 || adler32(output) !== expected) {
		return corrupt("The decompressed data fails its Adler-32 check.");
	}
	return success(output);
}

/**
 * Decodes raw DEFLATE data, with no zlib header or trailer.
 *
 * @param data - The compressed bytes.
 * @param size - The exact decompressed size.
 * @returns The decompressed bytes, or a `malformed` `FontError`.
 */
export function inflateRaw(data: Uint8Array, size: number): Result<Uint8Array, FontError> {
	let output = inflateStream(new BitReader(data), size);
	if (output === null) return corrupt("The compressed data is corrupt.");
	return success(output);
}

/**
 * Decodes DEFLATE blocks until the final one into a buffer of exactly `size` bytes.
 *
 * @param reader - Positioned at the first block.
 * @param size - The exact output size; producing more or fewer bytes is corruption.
 * @returns The output, or `null` when the stream is corrupt.
 */
function inflateStream(reader: BitReader, size: number): Uint8Array | null {
	let output = new Uint8Array(size);
	let position = 0;
	let last = 0;
	while (last === 0) {
		last = reader.read(1);
		let type = reader.read(2);
		if (reader.exhausted) return null;
		if (type === 0) {
			reader.align();
			let length = reader.read(16);
			let complement = reader.read(16);
			if ((length ^ 0xffff) !== complement || position + length > size) return null;
			let stored = reader.bytes(length);
			if (stored.length < length) return null;
			output.set(stored, position);
			position += length;
			continue;
		}
		if (type === 3) return null;
		let codes = type === 1 ? fixedCodes() : dynamicCodes(reader);
		if (codes === null) return null;
		position = inflateBlock(reader, codes, output, position);
		if (position < 0) return null;
	}
	return position === size ? output : null;
}

/**
 * Decodes one compressed block's symbols into `output`.
 *
 * @param reader - Positioned after the block header.
 * @param codes - The block's literal/length and distance codes.
 * @param output - The whole output buffer, which back references read from.
 * @param start - Where this block's output begins.
 * @returns The position after the block, or `-1` when the block is corrupt.
 */
function inflateBlock(
	reader: BitReader,
	codes: BlockCodes,
	output: Uint8Array,
	start: number,
): number {
	let position = start;
	for (;;) {
		let symbol = decodeSymbol(reader, codes.literals);
		if (symbol < 0 || reader.exhausted) return -1;
		if (symbol < 256) {
			if (position >= output.length) return -1;
			output[position++] = symbol;
			continue;
		}
		if (symbol === 256) return position;
		let index = symbol - 257;
		if (index >= LENGTH_BASE.length) return -1;
		let length = (LENGTH_BASE[index] ?? 0) + reader.read(LENGTH_EXTRA[index] ?? 0);
		let code = decodeSymbol(reader, codes.distances);
		if (code < 0 || code >= DISTANCE_BASE.length) return -1;
		let distance = (DISTANCE_BASE[code] ?? 0) + reader.read(DISTANCE_EXTRA[code] ?? 0);
		if (distance > position || position + length > output.length) return -1;
		copyMatch(output, position, distance, length);
		position += length;
	}
}

/**
 * Copies a back reference, byte by byte when it overlaps the bytes it produces.
 *
 * @param output - The output buffer.
 * @param position - Where the copy goes.
 * @param distance - How far back the source starts.
 * @param length - How many bytes.
 */
export function copyMatch(
	output: Uint8Array,
	position: number,
	distance: number,
	length: number,
): void {
	if (distance >= length) {
		output.copyWithin(position, position - distance, position - distance + length);
		return;
	}
	for (let index = 0; index < length; index++) {
		output[position + index] = output[position + index - distance] ?? 0;
	}
}

/** The codes of a fixed-Huffman block, from RFC 1951 §3.2.6. */
function fixedCodes(): BlockCodes {
	let lengths = new Uint8Array(288);
	lengths.fill(8, 0, 144);
	lengths.fill(9, 144, 256);
	lengths.fill(7, 256, 280);
	lengths.fill(8, 280, 288);
	let distances = new Uint8Array(30).fill(5);
	return {
		literals: huffmanTable(lengths, 288) ?? new Int32Array(0),
		distances: huffmanTable(distances, 30) ?? new Int32Array(0),
	};
}

/**
 * Reads the code definitions of a dynamic-Huffman block.
 *
 * @param reader - Positioned after the block type.
 * @returns The codes, or `null` when their definition is corrupt.
 */
function dynamicCodes(reader: BitReader): BlockCodes | null {
	let literalCount = reader.read(5) + 257;
	let distanceCount = reader.read(5) + 1;
	let codeLengthCount = reader.read(4) + 4;
	let codeLengths = new Uint8Array(19);
	for (let index = 0; index < codeLengthCount; index++) {
		codeLengths[CODE_LENGTH_ORDER[index] ?? 0] = reader.read(3);
	}
	let lengthCode = huffmanTable(codeLengths, 19);
	if (lengthCode === null) return null;

	let total = literalCount + distanceCount;
	let lengths = new Uint8Array(total);
	let index = 0;
	while (index < total) {
		let symbol = decodeSymbol(reader, lengthCode);
		if (symbol < 0 || reader.exhausted) return null;
		if (symbol < 16) {
			lengths[index++] = symbol;
			continue;
		}
		let value = 0;
		let repeat = 0;
		if (symbol === 16) {
			if (index === 0) return null;
			value = lengths[index - 1] ?? 0;
			repeat = 3 + reader.read(2);
		} else {
			repeat = symbol === 17 ? 3 + reader.read(3) : 11 + reader.read(7);
		}
		if (index + repeat > total) return null;
		lengths.fill(value, index, index + repeat);
		index += repeat;
	}
	if ((lengths[256] ?? 0) === 0) return null;
	let literals = huffmanTable(lengths.subarray(0, literalCount), literalCount);
	let distances = huffmanTable(lengths.subarray(literalCount), distanceCount);
	if (literals === null || distances === null) return null;
	return { literals, distances };
}

/**
 * The Adler-32 checksum zlib stores after the data.
 *
 * @param bytes - The decompressed bytes.
 */
function adler32(bytes: Uint8Array): number {
	let a = 1;
	let b = 0;
	for (let start = 0; start < bytes.length; start += 5552) {
		let end = Math.min(start + 5552, bytes.length);
		for (let index = start; index < end; index++) {
			a += bytes[index] ?? 0;
			b += a;
		}
		a %= 65521;
		b %= 65521;
	}
	return (b * 65536 + a) >>> 0;
}

/**
 * A `malformed` failure for corrupt compressed data.
 *
 * @param message - What is wrong.
 */
function corrupt(message: string): Result<never, FontError> {
	return failure(new FontError("malformed", message));
}
