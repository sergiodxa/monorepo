/**
 * Tests for the TypeID class and the typeid factory helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { generateUUID } from "@pkg/uuid";
import { describe, expect, test } from "vitest";

import { encode } from "./lib/base32";
import {
	EmptyPrefixError,
	InvalidBase32CharacterError,
	InvalidBase32StringError,
	InvalidPrefixError,
	InvalidSuffixLengthError,
	MissingSeparatorError,
	PrefixMismatchError,
	TypeIdError,
} from "./lib/errors";

import { typeid, TypeID } from "./index";

describe(TypeID.name, () => {
	test("creates a TypeID from a UUID", () => {
		let uuid = generateUUID();
		let value = TypeID.fromUUID("user", uuid);

		expect(value).toBeInstanceOf(TypeID);
		expect(value.prefix).toBe("user");
		expect(value.suffix).toBe(encode(uuid));
		expect(value.toUUID()).toBe(uuid);
		expect(value.toString()).toBe(`user_${encode(uuid)}`);
	});

	test("creates a TypeID from a string", () => {
		let uuid = generateUUID();
		let suffix = encode(uuid);
		let value = TypeID.fromString(`user_${suffix}`);

		expect(value.prefix).toBe("user");
		expect(value.suffix).toBe(suffix);
		expect(value.toUUID()).toBe(uuid);
	});

	test("creates a TypeID with an empty prefix", () => {
		let uuid = generateUUID();
		let suffix = encode(uuid);
		let value = TypeID.fromString(suffix);

		expect(value.prefix).toBe("");
		expect(value.suffix).toBe(suffix);
		expect(value.toString()).toBe(suffix);
	});

	test("throws when the prefix is invalid", () => {
		let uuid = generateUUID();

		expect(() => TypeID.fromUUID("User", uuid)).toThrow(InvalidPrefixError);
	});

	test("throws when the string prefix is empty", () => {
		expect(() => TypeID.fromString("_abc")).toThrow(EmptyPrefixError);
	});

	test("throws when the separator is missing for a non-empty prefix", () => {
		expect(() => TypeID.fromString("user01h5fskfsk4fpeqwnsyz5hj55t")).toThrow(
			MissingSeparatorError,
		);
	});

	test("throws when the suffix is empty", () => {
		expect(() => TypeID.fromString("user_")).toThrow(InvalidSuffixLengthError);
	});

	test("throws when the suffix length is not 26 characters", () => {
		expect(() => TypeID.fromString("user_123")).toThrow(InvalidSuffixLengthError);
		expect(() => TypeID.fromString("123")).toThrow(InvalidSuffixLengthError);
	});

	test("throws when the suffix contains invalid base32 characters", () => {
		expect(() => TypeID.fromString("user_01h5fskfsk4fpeqwnsyz5hj55i")).toThrow(
			InvalidBase32CharacterError,
		);
	});

	test("throws when the suffix overflows 128 bits", () => {
		expect(() => TypeID.fromString("user_8zzzzzzzzzzzzzzzzzzzzzzzzz")).toThrow(
			InvalidBase32StringError,
		);
	});

	test("throws when the prefix does not match", () => {
		let uuid = generateUUID();
		let suffix = encode(uuid);

		expect(() => TypeID.fromString(`user_${suffix}`, "org")).toThrow(PrefixMismatchError);
	});

	test("all TypeID parsing errors extend TypeIdError", () => {
		try {
			TypeID.fromString("user_123");
			throw new Error("Expected TypeID.fromString to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(TypeIdError);
		}
	});
});

describe(typeid.name, () => {
	test("returns a typed factory for a prefix", () => {
		let uuid = generateUUID();
		let createUserID = typeid("user");
		let value = createUserID(uuid);

		expect(value).toBeInstanceOf(TypeID);
		expect(value.prefix).toBe("user");
		expect(value.toUUID()).toBe(uuid);
	});
});
