/**
 * Checks the character reference table against the names the shipped XHTML sets
 * declare and the substitutions CommonMark demands of a numeric reference, so a
 * document naming a codepoint nobody assigned still decodes to text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { decodeEntity } from "./entities.js";

describe("named references", () => {
	test("resolves a name from each of the three sets", () => {
		expect(decodeEntity("&nbsp;", 0)).toEqual({ value: "\u00a0", end: 6 });
		expect(decodeEntity("&mdash;", 0)).toEqual({ value: "\u2014", end: 7 });
		expect(decodeEntity("&Omega;", 0)).toEqual({ value: "\u03a9", end: 7 });
	});

	test("resolves the names XML predefines", () => {
		expect(decodeEntity("&amp;", 0)?.value).toBe("&");
		expect(decodeEntity("&lt;", 0)?.value).toBe("<");
		expect(decodeEntity("&gt;", 0)?.value).toBe(">");
		expect(decodeEntity("&quot;", 0)?.value).toBe('"');
		expect(decodeEntity("&apos;", 0)?.value).toBe("'");
	});

	test("reads a reference that starts part way into the text", () => {
		expect(decodeEntity("a &copy; b", 2)).toEqual({ value: "\u00a9", end: 8 });
	});

	test("names nothing without a semicolon", () => {
		expect(decodeEntity("&amp", 0)).toBeNull();
	});

	test("names nothing outside the shipped sets", () => {
		expect(decodeEntity("&nowhere;", 0)).toBeNull();
	});

	test("reads only at an ampersand", () => {
		expect(decodeEntity("amp;", 0)).toBeNull();
	});
});

describe("numeric references", () => {
	test("resolves a decimal reference", () => {
		expect(decodeEntity("&#35;", 0)).toEqual({ value: "#", end: 5 });
	});

	test("resolves a hexadecimal reference in either case", () => {
		expect(decodeEntity("&#x22;", 0)?.value).toBe('"');
		expect(decodeEntity("&#X22;", 0)?.value).toBe('"');
	});

	test("resolves a reference above the basic plane", () => {
		expect(decodeEntity("&#x1F600;", 0)?.value).toBe("\u{1f600}");
	});

	test("substitutes the replacement character for the null codepoint", () => {
		expect(decodeEntity("&#0;", 0)?.value).toBe("\uFFFD");
	});

	test("substitutes the replacement character for a surrogate", () => {
		expect(decodeEntity("&#xD800;", 0)?.value).toBe("\uFFFD");
	});

	test("substitutes the replacement character past the last codepoint", () => {
		expect(decodeEntity("&#x110000;", 0)?.value).toBe("\uFFFD");
	});

	test("names nothing past the digit limits", () => {
		expect(decodeEntity("&#12345678;", 0)).toBeNull();
		expect(decodeEntity("&#x1234567;", 0)).toBeNull();
	});
});
