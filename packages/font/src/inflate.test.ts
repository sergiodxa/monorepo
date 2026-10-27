/**
 * Tests for the zlib and DEFLATE decoder against `node:zlib` output at every level, the
 * three block types, and corrupt streams, which must fail with a `FontError` rather than
 * throw or decode to the wrong size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { deflateRawSync, deflateSync } from "node:zlib";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { inflate, inflateRaw } from "./inflate.js";

const INTER = new Uint8Array(
	readFileSync(new URL("./fixtures/inter-regular.ttf", import.meta.url)),
);

/** Deterministic pseudo-random bytes, which DEFLATE stores rather than compresses. */
function noise(length: number): Uint8Array {
	let bytes = new Uint8Array(length);
	let state = 7;
	for (let index = 0; index < length; index++) {
		state = (state * 1103515245 + 12345) >>> 0;
		bytes[index] = state >>> 24;
	}
	return bytes;
}

/** Whether two byte arrays hold the same bytes. */
function same(left: Uint8Array, right: Uint8Array): boolean {
	return Buffer.from(left).equals(Buffer.from(right));
}

describe("inflate", () => {
	test("decodes zlib streams at every compression level", () => {
		let data = INTER.subarray(0, 60_000);
		for (let level = 0; level <= 9; level++) {
			let decoded = unwrap(inflate(deflateSync(data, { level }), data.length));
			expect(same(decoded, data)).toBe(true);
		}
	});

	test("decodes raw DEFLATE, the stream with its zlib header removed", () => {
		let data = new TextEncoder().encode("Fontkit WOFF and WOFF2 compression");
		expect(unwrap(inflateRaw(deflateSync(data).subarray(2), data.length))).toEqual(data);
		expect(unwrap(inflateRaw(deflateRawSync(data), data.length))).toEqual(data);
	});

	test("decodes stored, fixed-Huffman and dynamic-Huffman blocks", () => {
		let stored = noise(200_000);
		expect(same(unwrap(inflate(deflateSync(stored), stored.length)), stored)).toBe(true);
		let short = new TextEncoder().encode("abcabcabcabc");
		expect(unwrap(inflate(deflateSync(short), short.length))).toEqual(short);
		let repeated = new Uint8Array(100_000).fill(65);
		expect(same(unwrap(inflate(deflateSync(repeated), repeated.length)), repeated)).toBe(true);
		expect(unwrap(inflate(deflateSync(new Uint8Array(0)), 0))).toEqual(new Uint8Array(0));
	});

	test("fails on a size other than the stream's", () => {
		let data = INTER.subarray(0, 4000);
		let compressed = deflateSync(data);
		expect(isFailure(inflate(compressed, data.length - 1))).toBe(true);
		expect(isFailure(inflate(compressed, data.length + 1))).toBe(true);
	});

	test("fails on bad headers, preset dictionaries, checksums and truncation", () => {
		let data = INTER.subarray(0, 4000);
		let compressed = deflateSync(data);
		let header = Uint8Array.from(compressed);
		header[0] = 0x79;
		expect(isFailure(inflate(header, data.length))).toBe(true);
		let dictionary = Uint8Array.from(compressed);
		dictionary[1] = 0xbb;
		expect(isFailure(inflate(dictionary, data.length))).toBe(true);
		let checksum = Uint8Array.from(compressed);
		let last = checksum.length - 1;
		checksum[last] = (checksum[last] ?? 0) ^ 1;
		expect(isFailure(inflate(checksum, data.length))).toBe(true);
		expect(isFailure(inflate(compressed.subarray(0, compressed.length >> 1), data.length))).toBe(
			true,
		);
		expect(isFailure(inflate(new Uint8Array(0), 0))).toBe(true);
	});

	test("never throws on corrupt data", () => {
		let data = INTER.subarray(0, 4000);
		let compressed = deflateSync(data);
		for (let seed = 0; seed < 300; seed++) {
			let corrupt = Uint8Array.from(compressed);
			let at = 2 + ((seed * 7919) % (corrupt.length - 6));
			corrupt[at] = (corrupt[at] ?? 0) ^ (1 << (seed % 8));
			expect(() => inflate(corrupt, data.length)).not.toThrow();
			expect(() => inflateRaw(noise(64 + seed), 1000)).not.toThrow();
		}
	});
});
