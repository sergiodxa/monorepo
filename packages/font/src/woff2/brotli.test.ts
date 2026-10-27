/**
 * Tests for the Brotli decoder against streams `node:zlib` compresses at every quality and
 * window size, hand-made streams that reach uncompressed and metadata meta-blocks, the RFC's
 * check values for the static data, and corrupt input that must fail without throwing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { brotliCompressSync, constants } from "node:zlib";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	BROTLI_TRANSFORMS,
	CONTEXT_LUT0,
	CONTEXT_LUT1,
	CONTEXT_LUT2,
	decompressBrotli,
	staticDictionary,
} from "./brotli.js";

/** CRC-32 (ISO-HDLC), the check value RFC 7932 gives for its tables. */
function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (let byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/** Compresses with Node's Brotli encoder at a quality and window size. */
function compress(data: Uint8Array, quality: number, window = 22, mode = 0): Uint8Array {
	return brotliCompressSync(data, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: quality,
			[constants.BROTLI_PARAM_LGWIN]: window,
			[constants.BROTLI_PARAM_MODE]: mode,
			[constants.BROTLI_PARAM_SIZE_HINT]: data.length,
		},
	});
}

/** The RFC 7932 §11.1 trivial compressor: uncompressed meta-blocks of up to 64 KiB. */
function trivial(data: Uint8Array): Uint8Array {
	if (data.length === 0) return Uint8Array.of(6);
	let out: number[] = [12];
	let index = 0;
	for (; index + 65535 < data.length; index += 65536) {
		out.push(248, 255, 15, ...data.subarray(index, index + 65536));
	}
	if (index < data.length) {
		let rest = data.length - index - 1;
		out.push((rest & 31) << 3, rest >> 5, 8 + (rest >> 13), ...data.subarray(index));
	}
	out.push(3);
	return Uint8Array.from(out);
}

/** Deterministic pseudo-random bytes. */
function noise(length: number, seed = 1): Uint8Array {
	let bytes = new Uint8Array(length);
	let state = seed;
	for (let index = 0; index < length; index++) {
		state = (state * 1103515245 + 12345) >>> 0;
		bytes[index] = state >>> 24;
	}
	return bytes;
}

const TEXT = new TextEncoder().encode(
	"The quick brown fox jumps over the lazy dog. <html><head><title>Brotli</title></head>" +
		" A font, the fonts, of the people, by the people, for the people. ".repeat(40) +
		"Ünïcödé text — with “quotes” and CJK 漢字 mixed in, 0123456789 numbers.",
);

describe("decompressBrotli", () => {
	test("decodes Node's output at every quality", () => {
		for (let quality = 0; quality <= 11; quality++) {
			let decoded = decompressBrotli(compress(TEXT, quality));
			expect(unwrap(decoded)).toEqual(TEXT);
		}
	});

	test("decodes with the expected size argument", () => {
		let data = new TextEncoder().encode("Fontkit WOFF and WOFF2 compression");
		expect(unwrap(decompressBrotli(brotliCompressSync(data), data.length))).toEqual(data);
	});

	test("decodes small windows, where distant repeats become dictionary references", () => {
		let data = new Uint8Array([...TEXT, ...noise(5000), ...TEXT]);
		for (let window of [10, 12, 16, 24]) {
			expect(unwrap(decompressBrotli(compress(data, 11, window)))).toEqual(data);
		}
	});

	test("decodes text, font and generic modes over mixed data", () => {
		let data = new Uint8Array([...noise(3000, 7), ...TEXT, ...noise(200, 9).map((v) => v & 7)]);
		for (let mode of [0, 1, 2]) {
			for (let quality of [5, 9, 11]) {
				expect(unwrap(decompressBrotli(compress(data, quality, 18, mode)))).toEqual(data);
			}
		}
	});

	test("decodes incompressible and highly repetitive input larger than one meta-block", () => {
		let random = noise(300_000, 3);
		expect(Buffer.from(unwrap(decompressBrotli(compress(random, 6)))).equals(random)).toBe(true);
		let zeros = new Uint8Array(5_000_000);
		let decoded = unwrap(decompressBrotli(compress(zeros, 11), zeros.length));
		expect(decoded.length).toBe(zeros.length);
		expect(decoded.every((byte) => byte === 0)).toBe(true);
	});

	test("decodes the empty stream and uncompressed meta-blocks", () => {
		expect(unwrap(decompressBrotli(Uint8Array.of(6)))).toEqual(new Uint8Array(0));
		expect(unwrap(decompressBrotli(compress(new Uint8Array(0), 11)))).toEqual(new Uint8Array(0));
		let data = noise(140_000, 5);
		let decoded = unwrap(decompressBrotli(trivial(data), data.length));
		expect(Buffer.from(decoded).equals(data)).toBe(true);
	});

	test("skips metadata meta-blocks", () => {
		let data = new TextEncoder().encode("hello");
		let metadata = [0x2c, 0x01, ...new TextEncoder().encode("abc")];
		let stream = Uint8Array.from([...metadata, ...trivial(data).subarray(1)]);
		expect(unwrap(decompressBrotli(stream))).toEqual(data);
		expect(isFailure(decompressBrotli(stream.subarray(0, 4)))).toBe(true);
	});

	test("fails on truncated, corrupt or oversized streams without throwing", () => {
		let compressed = compress(TEXT, 11);
		expect(isFailure(decompressBrotli(compressed.subarray(0, compressed.length >> 1)))).toBe(true);
		expect(isFailure(decompressBrotli(compressed, TEXT.length - 1))).toBe(true);
		expect(isFailure(decompressBrotli(compressed, TEXT.length + 1))).toBe(true);
		expect(isFailure(decompressBrotli(new Uint8Array(0)))).toBe(true);
		for (let seed = 1; seed < 200; seed++) {
			let corrupt = Uint8Array.from(compressed);
			let at = (seed * 7919) % corrupt.length;
			corrupt[at] = (corrupt[at] ?? 0) ^ (1 << (seed % 8));
			let result = decompressBrotli(corrupt, TEXT.length);
			if (isSuccess(result)) expect(result.data.length).toBe(TEXT.length);
		}
		for (let seed = 1; seed < 50; seed++) {
			expect(() => decompressBrotli(noise(200, seed))).not.toThrow();
		}
	});
});

describe("static data", () => {
	test("the dictionary matches RFC 7932 Appendix A", () => {
		let dictionary = staticDictionary();
		expect(dictionary.length).toBe(122_784);
		expect(crc32(dictionary)).toBe(0x5136cb04);
	});

	test("the transforms match RFC 7932 Appendix B", () => {
		let bytes: number[] = [];
		for (let [prefix, kind, suffix] of BROTLI_TRANSFORMS) {
			for (let char of prefix) bytes.push(char.charCodeAt(0));
			bytes.push(0, kind);
			for (let char of suffix) bytes.push(char.charCodeAt(0));
			bytes.push(0);
		}
		expect(BROTLI_TRANSFORMS).toHaveLength(121);
		expect(bytes).toHaveLength(648);
		expect(crc32(Uint8Array.from(bytes))).toBe(0x3d965f81);
	});

	test("the context lookup tables match RFC 7932 §7.1", () => {
		expect(crc32(CONTEXT_LUT0)).toBe(0x8e91efb7);
		expect(crc32(CONTEXT_LUT1)).toBe(0xd01a32f4);
		expect(crc32(CONTEXT_LUT2)).toBe(0x0dd7a0d6);
	});
});
