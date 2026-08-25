/**
 * Tests for the TypeID Base32 encode, decode, and validation helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Base32 } from "./base32";

import { decode, encode, isBase32 } from "./base32";
import { InvalidBase32CharacterError, InvalidBase32StringError, TypeIdError } from "./errors";

describe("base32", () => {
	let uuid: string = "550e8400-e29b-41d4-a716-446655440000";

	test("encode returns a base32 string", () => {
		let value = encode(uuid);

		expect(value === value.toLowerCase()).toBe(true);
		expect(value.includes("-")).toBe(false);
		expect(isBase32(value)).toBe(true);
	});

	test("decode returns the original string", () => {
		let value = decode(encode(uuid) as Base32);

		expect(value).toBe(uuid);
	});

	test("encode and decode round-trip UUID strings", () => {
		let input = crypto.randomUUID();
		let encoded = encode(input);
		let decoded = decode(encoded);

		expect(decoded).toBe(input);
	});

	test("isBase32 rejects invalid characters", () => {
		expect(isBase32("hello-oops")).toBe(false);
		expect(isBase32("upperCASE")).toBe(false);
		expect(isBase32("l1o0")).toBe(false);
	});

	test("decode throws a custom error for invalid characters", () => {
		expect(() => decode("01h5fskfsk4fpeqwnsyz5hj55i" as Base32)).toThrow(
			InvalidBase32CharacterError,
		);
	});

	test("decode throws a custom error for invalid padding bits", () => {
		expect(() => decode("a" as Base32)).toThrow(InvalidBase32StringError);
	});

	test("isBase32 rejects non-strings", () => {
		expect(isBase32(null)).toBe(false);
		expect(isBase32(123)).toBe(false);
		expect(isBase32({ value: "d1jprv3f41vpwskkctng" })).toBe(false);
	});

	test("base32 decoding errors extend TypeIdError", () => {
		try {
			decode("upperCASE" as Base32);
			throw new Error("Expected decode to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(TypeIdError);
		}
	});
});
