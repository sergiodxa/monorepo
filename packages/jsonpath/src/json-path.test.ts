/**
 * The public API against RFC 9535's section 1.5 bookstore examples, plus what the suite does
 * not cover: error offsets, parsing once for many documents, and normalized path escaping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSONValue } from "./ast.js";

import { compileIRegexp } from "./i-regexp.js";
import { JSONPath, query } from "./json-path.js";
import { normalizedPath } from "./normalized-path.js";

/** The section 1.5 example document. */
const STORE: JSONValue = {
	store: {
		book: [
			{ category: "reference", author: "Nigel Rees", title: "Sayings of the Century", price: 8.95 },
			{ category: "fiction", author: "Evelyn Waugh", title: "Sword of Honour", price: 12.99 },
			{
				category: "fiction",
				author: "Herman Melville",
				title: "Moby Dick",
				isbn: "0-553-21311-3",
				price: 8.99,
			},
			{
				category: "fiction",
				author: "J. R. R. Tolkien",
				title: "The Lord of the Rings",
				isbn: "0-395-19395-8",
				price: 22.99,
			},
		],
		bicycle: { color: "red", price: 399 },
	},
};

/** The values `source` selects from the bookstore. */
function select(source: string): JSONValue[] {
	return unwrap(JSONPath.parse(source)).values(STORE);
}

describe("JSONPath", () => {
	test.each([
		[
			"$.store.book[*].author",
			["Nigel Rees", "Evelyn Waugh", "Herman Melville", "J. R. R. Tolkien"],
		],
		["$..author", ["Nigel Rees", "Evelyn Waugh", "Herman Melville", "J. R. R. Tolkien"]],
		["$.store..price", [8.95, 12.99, 8.99, 22.99, 399]],
		["$..book[2].author", ["Herman Melville"]],
		["$..book[2].publisher", []],
		["$..book[-1].title", ["The Lord of the Rings"]],
		["$..book[:2].title", ["Sayings of the Century", "Sword of Honour"]],
		["$..book[?@.isbn].title", ["Moby Dick", "The Lord of the Rings"]],
		["$..book[?@.price<10].title", ["Sayings of the Century", "Moby Dick"]],
		["$..book[?search(@.author, 'Tolk')].price", [22.99]],
		["$..book[?length(@.title) > 15].price", [8.95, 22.99]],
		["$.store.book[?count(@.*) == 5].author", ["Herman Melville", "J. R. R. Tolkien"]],
	])("%s selects the section 1.5 result", (source, expected) => {
		expect(select(source)).toEqual(expected);
	});

	test("returns each node's location and normalized path", () => {
		let nodes = unwrap(query(STORE, "$..book[?@.price > 20].title"));
		expect(nodes).toEqual([
			{
				value: "The Lord of the Rings",
				location: ["store", "book", 3, "title"],
				path: "$['store']['book'][3]['title']",
			},
		]);
	});

	test("selects from many documents with one parsed query", () => {
		let first = unwrap(JSONPath.parse("$[0]"));
		expect(first.values([1, 2])).toEqual([1]);
		expect(first.values({ a: 1 })).toEqual([]);
		expect(first.source).toBe("$[0]");
	});

	test("compares absolute queries inside a filter against the root", () => {
		expect(unwrap(query({ limit: 2, items: [1, 2, 3] }, "$.items[?@ >= $.limit]")).length).toBe(2);
	});

	test.each([
		["missing root", "store", 0],
		["trailing blank", "$.a ", 3],
		["unknown function", "$[?foo(@)]", 3],
		["ill-typed argument", "$[?length(@.*) == 1]", 10],
		["non-singular comparison", "$[?@.* == 1]", 3],
		["index beyond I-JSON", "$[9007199254740992]", 2],
	])("rejects a %s and reports where", (_label, source, offset) => {
		let result = JSONPath.parse(source);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.offset).toBe(offset);
	});
});

describe("normalizedPath", () => {
	test("escapes quotes, backslashes and control characters", () => {
		let name = `a'b${String.fromCharCode(0x5c)}c${String.fromCharCode(0x0a, 0x01)}`;
		let backslash = String.fromCharCode(0x5c);
		expect(normalizedPath([name, 0])).toBe(
			`$['a${backslash}'b${backslash}${backslash}c${backslash}n${backslash}u0001'][0]`,
		);
	});

	test("writes the root as $", () => {
		expect(normalizedPath([])).toBe("$");
	});
});

describe("compileIRegexp", () => {
	test("anchors match and leaves search open", () => {
		expect(compileIRegexp("b.", "match")?.test("abc")).toBe(false);
		expect(compileIRegexp("b.", "search")?.test("abc")).toBe(true);
	});

	test("keeps . from matching line breaks", () => {
		expect(compileIRegexp("a.b", "match")?.test(`a${String.fromCharCode(0x0a)}b`)).toBe(false);
	});

	test("supports categories, classes and bounded repetition", () => {
		expect(compileIRegexp("\\p{Lu}[a-z]{2,3}", "match")?.test("Abcd")).toBe(true);
		expect(compileIRegexp("[^0-9-]+", "match")?.test("ab-")).toBe(false);
	});

	test.each(["(a", "a)", "*a", "\\d", "(?=a)", "a{2", "[z-a]", "\\p{Xx}", "a{3,1}"])(
		"refuses %s, which is not an I-Regexp",
		(pattern) => {
			expect(compileIRegexp(pattern, "search")).toBeNull();
		},
	);
});
