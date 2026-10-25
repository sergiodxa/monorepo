/**
 * Tests for the decoder's refusals: malformed and truncated input, the limits that bound a
 * hostile document, repeated map keys, and the encodings deterministic decoding rules out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CBORErrorCode, DecodeOptions } from "./index.js";

import { decode, decodeFirst } from "./index.js";

/** The error code `decode` fails with, or `undefined` when it succeeds. */
function code(input: number[], options?: DecodeOptions): CBORErrorCode | undefined {
	let result = decode(Uint8Array.from(input), options);
	return isFailure(result) ? result.error.code : undefined;
}

describe("decode", () => {
	test("refuses bytes left over after the item, naming where they start", () => {
		let result = decode(Uint8Array.of(0x01, 0x01));
		expect(isFailure(result) && [result.error.code, result.error.offset]).toEqual([
			"trailing-bytes",
			1,
		]);
	});

	test("refuses input that ends inside an item", () => {
		expect(code([])).toBe("truncated");
		expect(code([0x43, 0x01])).toBe("truncated");
		expect(code([0x19, 0x01])).toBe("truncated");
		expect(code([0x9f, 0x01])).toBe("truncated");
	});

	test("refuses a length the input cannot hold before reading any element", () => {
		expect(code([0x9b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])).toBe("truncated");
		expect(code([0x5a, 0xff, 0xff, 0xff, 0xff])).toBe("truncated");
	});

	test("refuses the malformed encodings RFC 8949 Appendix F lists", () => {
		expect(code([0x1c])).toBe("malformed");
		expect(code([0xfd])).toBe("malformed");
		expect(code([0x1f])).toBe("malformed");
		expect(code([0xdf, 0x00])).toBe("malformed");
		expect(code([0xff])).toBe("malformed");
		expect(code([0x81, 0xff])).toBe("malformed");
		expect(code([0xf8, 0x18])).toBe("malformed");
		expect(code([0x5f, 0x61, 0x61, 0xff])).toBe("malformed");
		expect(code([0x5f, 0x5f, 0xff, 0xff])).toBe("malformed");
		expect(code([0xbf, 0x01, 0xff])).toBe("malformed");
	});

	test("refuses text that is not valid UTF-8", () => {
		expect(code([0x62, 0xc3, 0x28])).toBe("malformed");
		expect(code([0x7f, 0x61, 0xc3, 0x61, 0xbc, 0xff])).toBe("malformed");
	});

	test("refuses a bignum tag around anything but a byte string", () => {
		expect(code([0xc2, 0x01])).toBe("malformed");
	});

	test("refuses a map that repeats a key, including byte-string keys", () => {
		expect(code([0xa2, 0x01, 0x02, 0x01, 0x03])).toBe("duplicate-key");
		expect(code([0xa2, 0x41, 0x00, 0x01, 0x41, 0x00, 0x02])).toBe("duplicate-key");
		expect(code([0xa2, 0x01, 0x00, 0xf9, 0x3c, 0x00, 0x00])).toBe("duplicate-key");
	});

	test("stops at maxDepth, so deep nesting cannot exhaust the stack", () => {
		let deep = Array.from<number>({ length: 100_000 }).fill(0x81);
		expect(code([...deep, 0x00])).toBe("limit-exceeded");
		expect(code([0x81, 0x81, 0x00], { maxDepth: 1 })).toBe("limit-exceeded");
		expect(code([0x81, 0x81, 0x00], { maxDepth: 2 })).toBeUndefined();
	});

	test("stops at maxItems, bounding what one small input allocates", () => {
		expect(code([0x83, 0x80, 0x80, 0x80], { maxItems: 3 })).toBe("limit-exceeded");
		expect(code([0x83, 0x80, 0x80, 0x80], { maxItems: 4 })).toBeUndefined();
	});

	test("returns byte strings as copies, so later writes to the input do not reach them", () => {
		let input = Uint8Array.of(0x42, 0x01, 0x02);
		let value = unwrap(decode(input));
		input[1] = 0xff;
		expect(value).toEqual(Uint8Array.of(1, 2));
	});

	test("keeps integers within the safe range as numbers and beyond it as bigints", () => {
		expect(unwrap(decode(Uint8Array.of(0x1b, 0, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff)))).toBe(
			Number.MAX_SAFE_INTEGER,
		);
		expect(unwrap(decode(Uint8Array.of(0x3b, 0, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff)))).toBe(
			-(2n ** 53n),
		);
	});
});

describe("decode with deterministic", () => {
	test("refuses an argument longer than its value needs", () => {
		expect(code([0x18, 0x17], { deterministic: true })).toBe("not-deterministic");
		expect(code([0x19, 0x00, 0xff], { deterministic: true })).toBe("not-deterministic");
		expect(code([0x58, 0x01, 0x00], { deterministic: true })).toBe("not-deterministic");
	});

	test("refuses map keys out of bytewise order", () => {
		expect(code([0xa2, 0x03, 0x04, 0x01, 0x02], { deterministic: true })).toBe("not-deterministic");
		expect(code([0xa2, 0x61, 0x61, 0x01, 0x18, 0x18, 0x02], { deterministic: true })).toBe(
			"not-deterministic",
		);
	});

	test("refuses a bignum that fits in 64 bits or starts with a zero byte", () => {
		expect(code([0xc2, 0x41, 0x01], { deterministic: true })).toBe("not-deterministic");
		let padded = [0xc2, 0x4a, 0x00, 0x01, 0, 0, 0, 0, 0, 0, 0, 0];
		expect(code(padded, { deterministic: true })).toBe("not-deterministic");
	});

	test("refuses a NaN other than the half-precision quiet NaN", () => {
		expect(code([0xf9, 0x7e, 0x01], { deterministic: true })).toBe("not-deterministic");
	});
});

describe("decodeFirst", () => {
	test("reports where the item ended, so the caller can read what follows", () => {
		let { value, length } = unwrap(decodeFirst(Uint8Array.of(0x42, 0x01, 0x02, 0xde, 0xad)));
		expect(value).toEqual(Uint8Array.of(1, 2));
		expect(length).toBe(3);
	});
});
