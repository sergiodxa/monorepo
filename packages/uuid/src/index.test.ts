/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	assertUUID,
	generateUUID,
	InvalidUUIDFormatError,
	InvalidUUIDLengthError,
	InvalidUUIDTypeError,
	isUUID,
} from "./index.js";

describe(isUUID.name, () => {
	test("returns true for valid UUIDs", () => {
		let value = "550e8400-e29b-41d4-a716-446655440000";

		expect(isUUID(value)).toBe(true);
	});

	test("returns false for invalid UUIDs", () => {
		let value = "not-a-uuid";

		expect(isUUID(value)).toBe(false);
	});
});

describe(assertUUID.name, () => {
	test("does not throw for valid UUIDs", () => {
		let value = "550e8400-e29b-41d4-a716-446655440000";

		expect(() => assertUUID(value)).not.toThrow();
	});

	test("throws a length error for short UUIDs", () => {
		let value = "not-a-uuid";

		expect(() => assertUUID(value)).toThrow(InvalidUUIDLengthError);
		expect(() => assertUUID(value)).toThrow("Invalid UUID length: 10");
	});

	test("throws a format error for malformed UUID strings", () => {
		let value = "550e8400_e29b_41d4_a716_446655440000";

		expect(() => assertUUID(value)).toThrow(InvalidUUIDFormatError);
		expect(() => assertUUID(value)).toThrow(`Invalid UUID format: ${value}`);
	});

	test("throws a type error for non-string values", () => {
		expect(() => assertUUID(null as never)).toThrow(InvalidUUIDTypeError);
		expect(() => assertUUID(null as never)).toThrow("Expected a string, got object");
	});
});

describe(generateUUID.name, () => {
	test("returns a valid UUID", () => {
		let id = generateUUID();

		expect(isUUID(id)).toBe(true);
	});
});
