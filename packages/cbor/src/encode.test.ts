/**
 * Tests for the encoder: the deterministic choices it makes on its own and the values it
 * refuses rather than write as invalid CBOR.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CBORErrorCode, CBORValue } from "./index.js";

import { decode, encode, Simple, Tagged } from "./index.js";

/** The error code `encode` fails with, or `undefined` when it succeeds. */
function code(value: unknown): CBORErrorCode | undefined {
	let result = encode(value as CBORValue);
	return isFailure(result) ? result.error.code : undefined;
}

describe("encode", () => {
	test("sorts map keys by their encoded bytes, whatever order the Map holds them in", () => {
		let map = new Map<CBORValue, CBORValue>([
			["aa", 1],
			[100, 2],
			[-1, 3],
			["b", 4],
			[10, 5],
		]);
		let decoded = unwrap(decode(unwrap(encode(map)), { deterministic: true }));
		expect(decoded instanceof Map && [...decoded.keys()]).toEqual([10, 100, -1, "b", "aa"]);
	});

	test("writes the shortest float that holds a value exactly", () => {
		expect(unwrap(encode(0.5))).toEqual(Uint8Array.of(0xf9, 0x38, 0x00));
		expect(unwrap(encode(0.1))).toHaveLength(9);
		expect(unwrap(encode(2 ** 53))).toEqual(Uint8Array.of(0xfa, 0x5a, 0x00, 0x00, 0x00));
	});

	test("writes an integer beyond 64 bits as a bignum and reads it back", () => {
		let value = -(2n ** 70n);
		expect(unwrap(decode(unwrap(encode(value)), { deterministic: true }))).toBe(value);
	});

	test("round-trips tags, simple values and nested containers", () => {
		let value = [
			new Tagged(55799, new Map([[new Uint8Array([1]), [null, undefined]]])),
			new Simple(99),
		];
		expect(unwrap(decode(unwrap(encode(value))))).toEqual(value);
	});

	test("refuses two map keys that encode to the same bytes", () => {
		let map = new Map([
			[Uint8Array.of(1), 1],
			[Uint8Array.of(1), 2],
		]);
		expect(code(map)).toBe("duplicate-key");
	});

	test("refuses values CBOR cannot represent", () => {
		let cycle: CBORValue[] = [];
		cycle.push(cycle);
		expect(code(cycle)).toBe("unencodable");
		expect(code("\ud800")).toBe("unencodable");
		expect(code({ a: 1 })).toBe("unencodable");
		expect(code(() => 1)).toBe("unencodable");
		expect(code(new Simple(24))).toBe("unencodable");
		expect(code(new Simple(256))).toBe("unencodable");
		expect(code(new Tagged(-1, 0))).toBe("unencodable");
		expect(code(new Tagged(1.5, 0))).toBe("unencodable");
	});

	test("writes a value shared by two places twice, since only a cycle is refused", () => {
		let shared = [1];
		expect(unwrap(encode([shared, shared]))).toEqual(Uint8Array.of(0x82, 0x81, 0x01, 0x81, 0x01));
	});
});
