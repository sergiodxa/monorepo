/**
 * Tests for `parseRetryAfter()`: delay-seconds, the three HTTP-date spellings measured
 * from the caller's clock, and the values that name no usable delay.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { parseRetryAfter } from "./retry-after.js";

const NOW = new Date("1994-11-06T08:49:07Z");

describe(parseRetryAfter, () => {
	test("reads delay-seconds as milliseconds", () => {
		expect(parseRetryAfter("120")).toBe(120_000);
		expect(parseRetryAfter(" 0 ")).toBe(0);
	});

	test("measures an IMF-fixdate from now", () => {
		expect(parseRetryAfter("Sun, 06 Nov 1994 08:49:37 GMT", NOW)).toBe(30_000);
	});

	test("measures an RFC 850 date from now", () => {
		expect(parseRetryAfter("Sunday, 06-Nov-94 08:49:37 GMT", NOW)).toBe(30_000);
	});

	test("measures an asctime date from now, in UTC", () => {
		expect(parseRetryAfter("Sun Nov  6 08:49:37 1994", NOW)).toBe(30_000);
	});

	test("places a two-digit year more than 50 years ahead in the previous century", () => {
		let now = new Date("2026-01-01T00:00:00Z");
		expect(parseRetryAfter("Thursday, 01-Jan-26 00:00:10 GMT", now)).toBe(10_000);
		expect(parseRetryAfter("Sunday, 06-Nov-94 08:49:37 GMT", now)).toBe(0);
	});

	test("reads a date already past as no wait", () => {
		expect(parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT")).toBe(0);
	});

	test("measures a date from the current time when no clock is passed", () => {
		let at = new Date(Date.now() + 60_000).toUTCString();
		let wait = parseRetryAfter(at) ?? -1;
		expect(wait).toBeGreaterThan(55_000);
		expect(wait).toBeLessThanOrEqual(60_000);
	});

	test("answers null for a missing or unusable value", () => {
		expect(parseRetryAfter(null)).toBeNull();
		expect(parseRetryAfter("")).toBeNull();
		expect(parseRetryAfter("soon")).toBeNull();
		expect(parseRetryAfter("-5")).toBeNull();
		expect(parseRetryAfter("1.5")).toBeNull();
		expect(parseRetryAfter("2015-10-21T07:28:00Z")).toBeNull();
		expect(parseRetryAfter("Sat, 31 Feb 2015 07:28:00 GMT")).toBeNull();
	});
});
