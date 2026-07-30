/**
 * Tests for the HTTP-date formatter and parser.
 *
 * Formatting is checked against the spelling the specification fixes, and parsing
 * is checked to reject anything else, since a misread date is what would turn a
 * changed resource into a `304`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { lastModified, parseHttpDate } from "./http-date";

describe(lastModified, () => {
	test("formats a Date as an HTTP-date", () => {
		expect(lastModified(new Date("2015-10-21T07:28:00Z"))).toBe("Wed, 21 Oct 2015 07:28:00 GMT");
	});

	test("accepts epoch milliseconds", () => {
		expect(lastModified(Date.parse("2015-10-21T07:28:00Z"))).toBe("Wed, 21 Oct 2015 07:28:00 GMT");
	});

	test("drops sub-second precision, which the header cannot carry", () => {
		expect(lastModified(new Date("2015-10-21T07:28:00.999Z"))).toBe(
			"Wed, 21 Oct 2015 07:28:00 GMT",
		);
	});

	test("round-trips through the parser", () => {
		let date = new Date("2015-10-21T07:28:00Z");

		expect(parseHttpDate(lastModified(date))?.getTime()).toBe(date.getTime());
	});
});

describe(parseHttpDate, () => {
	test("parses the fixed HTTP-date spelling", () => {
		expect(parseHttpDate("Wed, 21 Oct 2015 07:28:00 GMT")?.toISOString()).toBe(
			"2015-10-21T07:28:00.000Z",
		);
	});

	test("returns null when the header is absent", () => {
		expect(parseHttpDate(null)).toBeNull();
	});

	test("returns null for text that is not a date", () => {
		expect(parseHttpDate("yesterday")).toBeNull();
	});

	test("returns null for a date in another format", () => {
		expect(parseHttpDate("2015-10-21T07:28:00Z")).toBeNull();
	});

	test("returns null for an impossible date in the right shape", () => {
		expect(parseHttpDate("Wed, 32 Oct 2015 07:28:00 GMT")).toBeNull();
	});
});
