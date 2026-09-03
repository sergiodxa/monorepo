/**
 * Tests for YAML parsing. Every expected value here was recorded from the `yaml`
 * library this parser replaced, so the file states the behavior the swap had to
 * reproduce as well as the constructs it deliberately turns into failures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { YAMLParseError } from "./errors";
import { parse as parseYAML } from "./parse";

/**
 * Parses source the subset covers, failing the test when it does not.
 *
 * @param source - YAML source text
 * @returns The parsed value
 */
function parse(source: string): unknown {
	let result = parseYAML(source);
	if (isFailure(result)) throw result.error;
	return result.data;
}

describe("parse", () => {
	describe("documents this repository ships", () => {
		test("reads a docs page's frontmatter", () => {
			let source = [
				"title: API Keys",
				"description: Create and manage API keys for programmatic access.",
				"section:",
				"  title: Team & Settings",
				"  order: 3",
				"order: 4",
				"lastUpdated: 2026-08-02",
			].join("\n");

			expect(parse(source)).toEqual({
				title: "API Keys",
				description: "Create and manage API keys for programmatic access.",
				section: { title: "Team & Settings", order: 3 },
				order: 4,
				lastUpdated: "2026-08-02",
			});
		});

		test("keeps an apostrophe and a bare ampersand inside a plain scalar", () => {
			let source = [
				"title: Alerts & Notifications",
				"description: You'll be monitoring your service in under 5 minutes.",
			].join("\n");

			expect(parse(source)).toEqual({
				title: "Alerts & Notifications",
				description: "You'll be monitoring your service in under 5 minutes.",
			});
		});

		test("reads a page written in Spanish", () => {
			let source = [
				"title: Servidor MCP",
				"description: Conectá este blog a tu agente para que pueda buscar y leer lo que escribo.",
			].join("\n");

			expect(parse(source)).toEqual({
				title: "Servidor MCP",
				description: "Conectá este blog a tu agente para que pueda buscar y leer lo que escribo.",
			});
		});
	});

	describe("scalars", () => {
		test("resolves the null spellings", () => {
			expect(parse("a: null\nb: Null\nc: NULL\nd: ~\ne:")).toEqual({
				a: null,
				b: null,
				c: null,
				d: null,
				e: null,
			});
		});

		test("resolves booleans, leaving the YAML 1.1 spellings as strings", () => {
			expect(parse("a: true\nb: TRUE\nc: false\nd: yes\ne: no\nf: on")).toEqual({
				a: true,
				b: true,
				c: false,
				d: "yes",
				e: "no",
				f: "on",
			});
		});

		test("resolves integers in the three bases the core schema names", () => {
			expect(parse("a: 1\nb: -3\nc: +4\nd: 0x1f\ne: 0o17\nf: 010\ng: 1_000")).toEqual({
				a: 1,
				b: -3,
				c: 4,
				d: 31,
				e: 15,
				f: 10,
				g: "1_000",
			});
		});

		test("resolves floats, infinities and not-a-number", () => {
			let value = parse("a: 1.5\nb: .5\nc: 5.\nd: 1e3\ne: .inf\nf: -.inf\ng: .nan") as Record<
				string,
				number
			>;

			expect(value.a).toBe(1.5);
			expect(value.b).toBe(0.5);
			expect(value.c).toBe(5);
			expect(value.d).toBe(1000);
			expect(value.e).toBe(Number.POSITIVE_INFINITY);
			expect(value.f).toBe(Number.NEGATIVE_INFINITY);
			expect(value.g).toBeNaN();
		});

		test("leaves a date as the text it was written as", () => {
			expect(parse("a: 2026-08-02\nb: 2026-08-02T10:00:00Z")).toEqual({
				a: "2026-08-02",
				b: "2026-08-02T10:00:00Z",
			});
		});

		test("reads quoted scalars and their escapes", () => {
			let source = ['a: "x: y"', "b: 'it''s'", 'c: "tab\\there"', 'd: "\\u00e9"', 'e: ""'].join(
				"\n",
			);

			expect(parse(source)).toEqual({ a: "x: y", b: "it's", c: "tab\there", d: "é", e: "" });
		});

		test("folds a plain scalar written across lines", () => {
			expect(parse("a: this is\n  a long value\nb: 2")).toEqual({
				a: "this is a long value",
				b: 2,
			});
			expect(parse("a: one\n\n  two\nb: 2")).toEqual({ a: "one\ntwo", b: 2 });
		});
	});

	describe("collections", () => {
		test("nests mappings by indentation", () => {
			expect(parse("a:\n  b:\n    c: 1\n  d: 2\ne: 3")).toEqual({
				a: { b: { c: 1 }, d: 2 },
				e: 3,
			});
		});

		test("reads a sequence indented under its key, and one flush against it", () => {
			expect(parse("tags:\n  - remix\n  - workers")).toEqual({ tags: ["remix", "workers"] });
			expect(parse("tags:\n- remix\n- workers")).toEqual({ tags: ["remix", "workers"] });
		});

		test("reads a mapping that starts on its own dash", () => {
			let source = ["items:", "  - title: a", "    order: 1", "  - title: b", "    order: 2"].join(
				"\n",
			);

			expect(parse(source)).toEqual({
				items: [
					{ title: "a", order: 1 },
					{ title: "b", order: 2 },
				],
			});
		});

		test("reads a dash carrying no value as null, and one carrying a block", () => {
			expect(parse("a:\n  -\n  - 1")).toEqual({ a: [null, 1] });
			expect(parse("a:\n  -\n    b: 1")).toEqual({ a: [{ b: 1 }] });
		});

		test("reads flow collections, nested and spanning lines", () => {
			expect(parse("a: [1, two, 'three']\nb: []")).toEqual({ a: [1, "two", "three"], b: [] });
			expect(parse("a: {x: 1, y: two}\nb: {}")).toEqual({ a: { x: 1, y: "two" }, b: {} });
			expect(parse("a: [{x: 1}, [2, 3]]")).toEqual({ a: [{ x: 1 }, [2, 3]] });
			expect(parse('a: ["x, y", 1,]')).toEqual({ a: ["x, y", 1] });
			expect(parse("a: [1,\n  2]")).toEqual({ a: [1, 2] });
		});

		test("takes the whole document as a sequence or a scalar", () => {
			expect(parse("- one\n- two")).toEqual(["one", "two"]);
			expect(parse("just a string")).toBe("just a string");
			expect(parse("a:b")).toBe("a:b");
		});
	});

	describe("block scalars", () => {
		test("keeps a literal block's line breaks and clips its ending", () => {
			expect(parse("a: |\n  line1\n  line2\nb: 2")).toEqual({ a: "line1\nline2\n", b: 2 });
		});

		test("strips and keeps the ending on request", () => {
			expect(parse("a: |-\n  line1\n  line2")).toEqual({ a: "line1\nline2" });
			expect(parse("a: |+\n  line1\n\nb: 2")).toEqual({ a: "line1\n\n", b: 2 });
		});

		test("folds a folded block, keeping blank lines and deeper indentation", () => {
			expect(parse("a: >\n  line1\n  line2\n\n  para2")).toEqual({ a: "line1 line2\npara2\n" });
			expect(parse("a: >\n  line1\n    indented\n  line3")).toEqual({
				a: "line1\n  indented\nline3\n",
			});
		});

		test("reads a block introduced by a dash", () => {
			expect(parse("a:\n  - |\n    text\n  - 2")).toEqual({ a: ["text\n", 2] });
		});

		test("takes the indentation an explicit indicator states", () => {
			expect(parse("a: |2\n   text")).toEqual({ a: " text\n" });
			expect(parse("a: |2-\n  text")).toEqual({ a: "text" });
		});
	});

	describe("comments and document markers", () => {
		test("drops whole-line and trailing comments", () => {
			expect(parse("# top\na: 1 # trailing\n# mid\nb: 2")).toEqual({ a: 1, b: 2 });
			expect(parse("a: #c\nb: 1")).toEqual({ a: null, b: 1 });
		});

		test("keeps a hash that sits inside a value", () => {
			expect(parse("a: v1#2 #c")).toEqual({ a: "v1#2" });
			expect(parse("a: 'a # b'")).toEqual({ a: "a # b" });
		});

		test("ends the document at a `...` marker", () => {
			expect(parse("a: 1\n...")).toEqual({ a: 1 });
		});

		test("reads an empty or comment-only block as null", () => {
			expect(parse("")).toBeNull();
			expect(parse("\n\n")).toBeNull();
			expect(parse("# nothing")).toBeNull();
		});

		test("reads CRLF line endings", () => {
			expect(parse("a: 1\r\nb: 2\r\nc: 3")).toEqual({ a: 1, b: 2, c: 3 });
			expect(parse("a: |\r\n  one\r\n  two\r\n")).toEqual({ a: "one\ntwo\n" });
		});
	});

	describe("keys", () => {
		test("reads a quoted key", () => {
			expect(parse("\"a b\": 1\n'c': 2")).toEqual({ "a b": 1, c: 2 });
		});

		test("gives a document naming `__proto__` an own property", () => {
			let value = parse("__proto__: 1\na: 2") as Record<string, unknown>;

			expect(Object.hasOwn(value, "__proto__")).toBe(true);
			expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
			expect(value.a).toBe(2);
		});
	});

	describe("failures", () => {
		test.for([
			["a duplicate key", "a: 1\na: 2"],
			["an anchor", "a: &x 1"],
			["an alias", "a: &x 1\nb: *x"],
			["a merge key", "a:\n  <<: b"],
			["a tag", "a: !!str 1"],
			["an explicit key", "? a\n: 1"],
			["a second document", "a: 1\n---\nb: 2"],
			["a directive", "%YAML 1.2\na: 1"],
			["tab indentation", "a:\n\tb: 1"],
			["unexpected indentation", "a: 1\n   b: 2"],
			["a value that is also a mapping", "a: b: c"],
			["an unterminated flow collection", "a: [1,"],
			["a quoted value left open", 'a: "abc'],
			["a quoted value spanning lines", "a: 'one\n  two'"],
			["content after a quoted value", "a: 'x'y"],
			["content after a flow collection", "a: [1] extra"],
			["a reserved character opening a value", "a: @handle"],
			["an empty flow sequence entry", "a: [1,,2]"],
			["an invalid escape", 'a: "one\\qtwo"'],
		])("fails on %s", ([, source]) => {
			let result = parseYAML(source as string);

			expect(isSuccess(result)).toBe(false);
			if (!isFailure(result)) return;
			expect(result.error).toBeInstanceOf(YAMLParseError);
			expect(result.error.line).toBeGreaterThan(0);
		});
	});
});
