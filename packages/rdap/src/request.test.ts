/**
 * Checks `Retry-After` parsing, both RFC 9110 forms and the header a lookup ignores.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { retryAfterMs } from "./request.js";

describe("retryAfterMs", () => {
	test("reads delay-seconds", () => {
		expect(retryAfterMs("30")).toBe(30_000);
		expect(retryAfterMs(" 0 ")).toBe(0);
	});

	test("reads an HTTP date as the time left until it", () => {
		let at = new Date(Date.now() + 60_000).toUTCString();
		let wait = retryAfterMs(at) ?? -1;
		expect(wait).toBeGreaterThan(50_000);
		expect(wait).toBeLessThanOrEqual(60_000);
	});

	test("counts a date already past as zero", () => {
		expect(retryAfterMs("Wed, 21 Oct 2015 07:28:00 GMT")).toBe(0);
	});

	test("ignores a missing or malformed header", () => {
		expect(retryAfterMs(null)).toBeUndefined();
		expect(retryAfterMs("soon")).toBeUndefined();
		expect(retryAfterMs("-5")).toBeUndefined();
	});
});
