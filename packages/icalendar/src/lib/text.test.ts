/**
 * Checks TEXT escaping in both directions (RFC 5545 §3.3.11), including the `\N` a reader
 * must accept and the comma lists whose separators are the unescaped commas only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { escapeText, splitList, unescapeText } from "./text.js";

describe("escapeText", () => {
	test("escapes backslashes, semicolons, commas and newlines", () => {
		expect(escapeText("a\\b;c,d\ne")).toBe(String.raw`a\\b\;c\,d\ne`);
	});

	test("writes every newline form as \\n", () => {
		expect(escapeText("a\r\nb\rc")).toBe("a\\nb\\nc");
	});

	test("leaves colons and quotes alone", () => {
		expect(escapeText('Room: "4350"')).toBe('Room: "4350"');
	});
});

describe("unescapeText", () => {
	test("undoes every escape", () => {
		expect(unescapeText(String.raw`a\\b\;c\,d\ne`)).toBe("a\\b;c,d\ne");
	});

	test("accepts \\N for a newline", () => {
		expect(unescapeText("one\\Ntwo")).toBe("one\ntwo");
	});

	test("reads an unknown escape as the character after it", () => {
		expect(unescapeText("10\\:30")).toBe("10:30");
	});

	test("round trips through escapeText", () => {
		let text = "Atlanta, Georgia; \\ backslash\nnext line";
		expect(unescapeText(escapeText(text))).toBe(text);
	});
});

describe("splitList", () => {
	test("splits on unescaped commas only", () => {
		expect(splitList("a\\,b,c,d\\\\,e")).toEqual(["a\\,b", "c", "d\\\\", "e"]);
	});

	test("returns one empty item for an empty value", () => {
		expect(splitList("")).toEqual([""]);
	});
});
