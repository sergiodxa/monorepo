/**
 * Covers the length rule: the NIST defaults, the configurable bounds, and that length is
 * counted in code points of the NFKC form rather than UTF-16 units of the raw input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { checkLength, DEFAULT_MAX_LENGTH, DEFAULT_MIN_LENGTH } from "./length.js";
import { PasswordPolicyError } from "./password-policy-error.js";

describe("checkLength", () => {
	test("defaults to NIST's single-factor minimum and a 256 code point maximum", () => {
		expect(DEFAULT_MIN_LENGTH).toBe(15);
		expect(DEFAULT_MAX_LENGTH).toBe(256);
	});

	test("refuses a candidate under the default minimum with the bound and the length", () => {
		let result = checkLength("a".repeat(14));

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(PasswordPolicyError);
		expect(result.error.issue).toEqual({ reason: "too-short", minLength: 15, length: 14 });
	});

	test("accepts a candidate exactly at the minimum", () => {
		expect(isSuccess(checkLength("a".repeat(15)))).toBe(true);
	});

	test("honours a configured minimum", () => {
		expect(isSuccess(checkLength("a".repeat(8), { minLength: 8 }))).toBe(true);

		let result = checkLength("a".repeat(7), { minLength: 8 });
		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "too-short", minLength: 8, length: 7 });
	});

	test("refuses a candidate over the default maximum", () => {
		let result = checkLength("a".repeat(257));

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "too-long", maxLength: 256, length: 257 });
	});

	test("accepts a candidate exactly at a configured maximum", () => {
		expect(isSuccess(checkLength("a".repeat(20), { minLength: 8, maxLength: 20 }))).toBe(true);
		expect(isFailure(checkLength("a".repeat(21), { minLength: 8, maxLength: 20 }))).toBe(true);
	});

	test("counts a surrogate pair as one character", () => {
		let emoji = "😀".repeat(10);

		expect(emoji.length).toBe(20);
		expect(isSuccess(checkLength(emoji, { minLength: 10, maxLength: 10 }))).toBe(true);
	});

	test("counts after NFKC, so a decomposed accent and its composed form measure the same", () => {
		let decomposed = "é".repeat(8);

		let result = checkLength(decomposed, { minLength: 9 });
		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "too-short", minLength: 9, length: 8 });
	});

	test("counts a compatibility ligature as the letters it stands for", () => {
		expect(isSuccess(checkLength("ﬁ".repeat(4), { minLength: 8 }))).toBe(true);
	});
});
