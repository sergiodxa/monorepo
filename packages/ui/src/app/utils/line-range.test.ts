/**
 * Tests for the two address forms a cited range of lines takes: the `?L=` query a server
 * paints and the `#L` fragment a script writes, read in either order and written back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { lineLink, lineRangeHash, lineRangeQuery, parseLineRange } from "./line-range.js";

describe("parseLineRange", () => {
	test("reads query values and fragments", () => {
		expect(parseLineRange("3-8")).toEqual({ start: 3, end: 8 });
		expect(parseLineRange("12")).toEqual({ start: 12, end: 12 });
		expect(parseLineRange("#L3-L8")).toEqual({ start: 3, end: 8 });
		expect(parseLineRange("L5")).toEqual({ start: 5, end: 5 });
	});

	test("orders a range written backwards", () => {
		expect(parseLineRange("#L8-L3")).toEqual({ start: 3, end: 8 });
	});

	test("reads anything else as no range", () => {
		expect(parseLineRange(null)).toBeUndefined();
		expect(parseLineRange("")).toBeUndefined();
		expect(parseLineRange("#discussion_r1")).toBeUndefined();
		expect(parseLineRange("0")).toBeUndefined();
		expect(parseLineRange("3-")).toBeUndefined();
	});
});

describe("lineRangeQuery and lineRangeHash", () => {
	test("write one line without a dash", () => {
		expect(lineRangeQuery({ start: 4, end: 4 })).toBe("4");
		expect(lineRangeHash({ start: 4, end: 4 })).toBe("#L4");
	});

	test("write a range", () => {
		expect(lineRangeQuery({ start: 3, end: 8 })).toBe("3-8");
		expect(lineRangeHash({ start: 3, end: 8 })).toBe("#L3-L8");
	});
});

describe("lineLink", () => {
	test("carries the line as a query and as the anchor", () => {
		expect(lineLink(10)).toBe("?L=10#L10");
	});

	test("keeps the page's other parameters and replaces an earlier line", () => {
		expect(lineLink(10, "/blob/app.ts?plain=1&L=3-8#L3")).toBe("/blob/app.ts?plain=1&L=10#L10");
	});
});
