import { describe, expect, test } from "vitest";

import { isValidPrefix } from "./is-valid-prefix";

describe(isValidPrefix.name, () => {
	test("returns true for valid prefixes", () => {
		expect(isValidPrefix("a")).toBe(true);
		expect(isValidPrefix("user")).toBe(true);
		expect(isValidPrefix("user_profile")).toBe(true);
		expect(isValidPrefix("a".repeat(63))).toBe(true);
	});

	test("returns false for prefixes longer than 63 characters", () => {
		expect(isValidPrefix("a".repeat(64))).toBe(false);
	});

	test("returns false when prefix starts or ends with underscore", () => {
		expect(isValidPrefix("_user")).toBe(false);
		expect(isValidPrefix("user_")).toBe(false);
	});

	test("returns false for uppercase letters, numbers, and symbols", () => {
		expect(isValidPrefix("User")).toBe(false);
		expect(isValidPrefix("user1")).toBe(false);
		expect(isValidPrefix("user-profile")).toBe(false);
	});
});
