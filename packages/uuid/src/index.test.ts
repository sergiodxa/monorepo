import { describe, expect, test } from "bun:test";

import { assertUUID, generateUUID, isUUID } from "./index";

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

	test("throws TypeError for invalid UUIDs", () => {
		let value = "not-a-uuid";

		expect(() => assertUUID(value)).toThrow(TypeError);
		expect(() => assertUUID(value)).toThrow(`Invalid UUID: ${value}`);
	});
});

describe(generateUUID.name, () => {
	test("returns a valid UUID", () => {
		let id = generateUUID();

		expect(isUUID(id)).toBe(true);
	});
});
