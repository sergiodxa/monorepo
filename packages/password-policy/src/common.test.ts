/**
 * Covers the bundled common-password check: case- and compatibility-insensitive
 * matching, the list's own shape (folded, deduplicated, above its floor), and the
 * license notice that travels with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { COMMON_PASSWORDS } from "./common-passwords.data.js";
import {
	checkCommonPassword,
	COMMON_PASSWORDS_MIN_LENGTH,
	COMMON_PASSWORDS_NOTICE,
	isCommonPassword,
} from "./common.js";
import { countCodePoints, foldPassword } from "./normalize.js";

describe("isCommonPassword", () => {
	test("matches a well-known password", () => {
		expect(isCommonPassword("password1")).toBe(true);
		expect(isCommonPassword("qwertyuiop")).toBe(true);
		expect(isCommonPassword("iloveyou")).toBe(true);
	});

	test("matches regardless of case", () => {
		expect(isCommonPassword("PassWord1")).toBe(true);
	});

	test("matches a fullwidth spelling through NFKC", () => {
		expect(isCommonPassword("ｐａｓｓｗｏｒｄ１")).toBe(true);
	});

	test("lets an uncommon passphrase through", () => {
		expect(isCommonPassword("violet staircase under the harbour")).toBe(false);
	});

	test("holds no entry shorter than its floor, which is NIST's absolute minimum", () => {
		expect(COMMON_PASSWORDS_MIN_LENGTH).toBe(8);
		expect(isCommonPassword("123456")).toBe(false);
	});
});

describe("checkCommonPassword", () => {
	test("reports a common password with the `common` reason", () => {
		let result = checkCommonPassword("Password1");

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "common" });
	});

	test("succeeds for an uncommon candidate", () => {
		expect(isSuccess(checkCommonPassword("violet staircase under the harbour"))).toBe(true);
	});
});

describe("the bundled list", () => {
	let entries = COMMON_PASSWORDS.split("\n");

	test("is a real corpus, not a placeholder", () => {
		expect(entries.length).toBeGreaterThan(40_000);
	});

	test("stores every entry folded, unique, and at or above the floor", () => {
		expect(new Set(entries).size).toBe(entries.length);

		for (let entry of entries) {
			expect(foldPassword(entry)).toBe(entry);
			expect(countCodePoints(entry)).toBeGreaterThanOrEqual(COMMON_PASSWORDS_MIN_LENGTH);
		}
	});

	test("carries the SecLists MIT notice", () => {
		expect(COMMON_PASSWORDS_NOTICE).toContain("MIT License");
		expect(COMMON_PASSWORDS_NOTICE).toContain("Copyright (c) 2018 Daniel Miessler");
	});
});
