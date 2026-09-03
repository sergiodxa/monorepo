/**
 * Tests for `parseDate`: that readable input becomes a `Date` and unreadable input
 * becomes a named failure, so every downstream calculation works from a genuinely
 * valid instant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { InvalidDateError } from "./invalid-date-error.js";
import { parseDate } from "./parse-date.js";

describe("parseDate", () => {
	test("reads a full ISO 8601 instant", () => {
		expect(unwrap(parseDate("2026-07-29T10:00:00Z")).toISOString()).toBe(
			"2026-07-29T10:00:00.000Z",
		);
	});

	test("reads a millisecond timestamp", () => {
		expect(unwrap(parseDate(1_785_492_000_000)).getTime()).toBe(1_785_492_000_000);
	});

	test("reads a date-only string as UTC midnight", () => {
		expect(unwrap(parseDate("2026-07-29")).toISOString()).toBe("2026-07-29T00:00:00.000Z");
	});

	test("fails on text that names no instant", () => {
		for (let input of ["", "not a date", "2026-13-45T00:00:00Z"]) {
			expect(isFailure(parseDate(input))).toBe(true);
		}
	});

	test("fails on a non-finite timestamp", () => {
		expect(isFailure(parseDate(Number.NaN))).toBe(true);
		expect(isFailure(parseDate(Number.POSITIVE_INFINITY))).toBe(true);
	});

	test("never returns an invalid date on the success path", () => {
		let result = parseDate("2026-07-29T10:00:00Z");
		expect(Number.isNaN(unwrap(result).getTime())).toBe(false);
	});

	test("names the rejected input on the error", () => {
		let result = parseDate("not a date");
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(InvalidDateError);
		expect(result.error.input).toBe("not a date");
		expect(result.error.message).toBe('Invalid date: "not a date"');
	});
});
