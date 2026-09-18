/**
 * Tests for the CBOR reader, covering the encodings WebAuthn structures use
 * and the malformed ones a hostile client could send instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { decode, read } from "./cbor.js";

describe("decode", () => {
	test("reads the integers COSE labels are written as", () => {
		expect(unwrap(decode(Uint8Array.of(0x01)))).toBe(1);
		expect(unwrap(decode(Uint8Array.of(0x18, 0xff)))).toBe(255);
		expect(unwrap(decode(Uint8Array.of(0x26)))).toBe(-7);
		expect(unwrap(decode(Uint8Array.of(0x39, 0x01, 0x00)))).toBe(-257);
	});

	test("reads a map keyed by integers, as a COSE key is", () => {
		let value = unwrap(decode(Uint8Array.of(0xa2, 0x01, 0x02, 0x03, 0x26)));
		expect(value).toBeInstanceOf(Map);
		expect((value as Map<number, number>).get(1)).toBe(2);
		expect((value as Map<number, number>).get(3)).toBe(-7);
	});

	test("reads text and byte strings", () => {
		expect(unwrap(decode(Uint8Array.of(0x63, 0x66, 0x6d, 0x74)))).toBe("fmt");
		expect(unwrap(decode(Uint8Array.of(0x42, 0x01, 0x02)))).toEqual(Uint8Array.of(1, 2));
	});

	test("refuses bytes left over after the item", () => {
		expect(isFailure(decode(Uint8Array.of(0x01, 0x01)))).toBe(true);
	});

	test("refuses a truncated item", () => {
		expect(isFailure(decode(Uint8Array.of(0x43, 0x01)))).toBe(true);
	});

	test("refuses the indefinite lengths canonical CBOR never emits", () => {
		expect(isFailure(decode(Uint8Array.of(0x5f, 0x41, 0x01, 0xff)))).toBe(true);
	});
});

describe("read", () => {
	test("reports where the item ended, so the caller can continue", () => {
		let [value, offset] = unwrap(read(Uint8Array.of(0x42, 0x01, 0x02, 0xde, 0xad)));
		expect(value).toEqual(Uint8Array.of(1, 2));
		expect(offset).toBe(3);
	});
});
