/**
 * Tests for `If-Modified-Since` reading and comparison.
 *
 * The boundary case is the point: a resource written in the same second the
 * client stored its copy counts as unmodified, so a second-precision header is
 * never read as a change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { ifModifiedSince, isModifiedSince } from "./if-modified-since";

/** The modification time every comparison in this file is made against. */
const MODIFIED_AT = new Date("2015-10-21T07:28:00Z");

describe(ifModifiedSince, () => {
	test("reads the date the client sent", () => {
		let headers = new Headers({ "If-Modified-Since": "Wed, 21 Oct 2015 07:28:00 GMT" });

		expect(ifModifiedSince(headers)?.getTime()).toBe(MODIFIED_AT.getTime());
	});

	test("returns null when the header is absent", () => {
		expect(ifModifiedSince(new Headers())).toBeNull();
	});

	test("returns null when the header is not a valid HTTP-date", () => {
		expect(ifModifiedSince(new Headers({ "If-Modified-Since": "0" }))).toBeNull();
	});
});

describe(isModifiedSince, () => {
	test("is false at the modification time", () => {
		expect(isModifiedSince(MODIFIED_AT, MODIFIED_AT)).toBe(false);
	});

	test("is true when the client's copy is older", () => {
		expect(isModifiedSince(MODIFIED_AT, new Date("2015-10-21T07:27:59Z"))).toBe(true);
	});

	test("is false when the client's copy is newer", () => {
		expect(isModifiedSince(MODIFIED_AT, new Date("2015-10-21T07:28:01Z"))).toBe(false);
	});

	test("ignores sub-second differences the header cannot express", () => {
		expect(isModifiedSince(new Date("2015-10-21T07:28:00.999Z"), MODIFIED_AT)).toBe(false);
	});

	test("accepts epoch milliseconds on either side", () => {
		expect(isModifiedSince(2000, 1000)).toBe(true);
		expect(isModifiedSince(1000, 2000)).toBe(false);
	});
});
