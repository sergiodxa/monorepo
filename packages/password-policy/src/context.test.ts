/**
 * Covers the context-specific rules: a candidate built from the account's own
 * identifiers, and one containing a term the service denies, both matched
 * case-insensitively after NFKC.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { checkDeniedTerms, checkIdentifiers } from "./context.js";

describe("checkIdentifiers", () => {
	test("refuses a candidate containing an email's local part", () => {
		let result = checkIdentifiers("jane.doe-rocks-2026", ["jane.doe@example.com"]);

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "similar-to-identifier", fragment: "jane.doe" });
	});

	test("refuses a candidate containing the email's domain label", () => {
		let result = checkIdentifiers("my-example-secret", ["jane@example.com"]);

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "similar-to-identifier", fragment: "example" });
	});

	test("refuses a candidate containing a username", () => {
		let result = checkIdentifiers("xx-janedoe-xx", ["JaneDoe"]);

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "similar-to-identifier", fragment: "janedoe" });
	});

	test("refuses a candidate contained in a longer identifier", () => {
		let result = checkIdentifiers("verylongname", ["averyverylongname1990"]);

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue.reason).toBe("similar-to-identifier");
	});

	test("matches case-insensitively after NFKC", () => {
		expect(isSuccess(checkIdentifiers("ＪＡＮＥＤＯＥ-secret", ["janedoe"]))).toBe(false);
	});

	test("ignores fragments under three characters, which would match almost anything", () => {
		expect(isSuccess(checkIdentifiers("jojo-x-marks-the-spot", ["jo@x.io"]))).toBe(true);
	});

	test("accepts an unrelated candidate and an empty identifier list", () => {
		expect(isSuccess(checkIdentifiers("violet staircase harbour", ["jane@example.com"]))).toBe(
			true,
		);
		expect(isSuccess(checkIdentifiers("violet staircase harbour", []))).toBe(true);
	});
});

describe("checkDeniedTerms", () => {
	test("refuses a candidate containing a denied term and names the term as configured", () => {
		let result = checkDeniedTerms("i love acme corp", ["Acme"]);

		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error.issue).toEqual({ reason: "denied-term", term: "Acme" });
	});

	test("matches a term through NFKC and case folding", () => {
		expect(isSuccess(checkDeniedTerms("ＡＣＭＥ forever and ever", ["acme"]))).toBe(false);
	});

	test("skips an empty term rather than matching every candidate", () => {
		expect(isSuccess(checkDeniedTerms("violet staircase harbour", ["", "  "]))).toBe(true);
	});

	test("accepts a candidate containing none of the terms", () => {
		expect(isSuccess(checkDeniedTerms("violet staircase harbour", ["acme"]))).toBe(true);
	});
});
