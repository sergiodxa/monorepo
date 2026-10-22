/**
 * `strip` keeps every offset: comments and trailing commas become spaces of the same length,
 * strings are left untouched, and line breaks inside a block comment stay where they were.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { strip } from "./index.js";

describe("strip", () => {
	test("blanks line and block comments to the same length", () => {
		let text = '{"a": 1, // one\n"b": /* two\nlines */ 2}';
		let stripped = strip(text);

		expect(stripped).toHaveLength(text.length);
		expect(stripped).toBe('{"a": 1,       \n"b":       \n         2}');
	});

	test("leaves comment markers inside strings alone, escaped quotes included", () => {
		let text = '{"url": "https://example.com", "q": "say \\"/* hi */\\""}';

		expect(strip(text)).toBe(text);
	});

	test("blanks a comma before a closing bracket, past whitespace and comments", () => {
		expect(strip("[1, 2, /* end */\n]")).toBe("[1, 2           \n]");
		expect(strip('{"a": 1,}')).toBe('{"a": 1 }');
	});

	test("keeps a comma that follows no value", () => {
		expect(strip("[,]")).toBe("[,]");
		expect(strip("[1,,]")).toBe("[1,,]");
		expect(strip("{,}")).toBe("{,}");
	});

	test("replaces a leading byte-order mark with a space", () => {
		expect(strip("\uFEFF{}")).toBe(" {}");
	});
});
