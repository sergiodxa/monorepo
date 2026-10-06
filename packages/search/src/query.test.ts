/**
 * Tests for `parseQuery`, `highlight` and `excerpt`: the inputs FTS5 rejects as syntax all
 * parse as plain terms, prefix rules and limits hold, and highlighting maps folded matches
 * back onto the text exactly as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import type { ParsedQuery } from "./query.js";

import { excerpt, highlight, parseQuery } from "./query.js";

/** Parses a query the test knows is valid and non-blank. */
function parsed(input: string, options?: Parameters<typeof parseQuery>[1]): ParsedQuery {
	let query = unwrap(parseQuery(input, options));
	if (query === null) throw new Error(`expected terms from ${JSON.stringify(input)}`);
	return query;
}

describe("parseQuery", () => {
	test("reads words, phrases, exclusions and a trailing star", () => {
		expect(parsed(`remix "route pattern" -legacy data*`)).toEqual({
			text: `remix "route pattern" -legacy data*`,
			terms: [
				{ text: "remix", phrase: false, prefix: true, exclude: false },
				{ text: "route pattern", phrase: true, prefix: false, exclude: false },
				{ text: "legacy", phrase: false, prefix: true, exclude: true },
				{ text: "data", phrase: false, prefix: true, exclude: false },
			],
		});
	});

	test("answers null for a blank box", () => {
		expect(unwrap(parseQuery(""))).toBeNull();
		expect(unwrap(parseQuery("   \n\t"))).toBeNull();
	});

	test.each([`foo"`, "AND", "OR", "NOT", "NEAR", "a:b", "c++", "it's", "(x)", "x^y"])(
		"reads %s as a plain term",
		(input) => {
			let query = parsed(input);
			expect(query.terms.every((term) => !term.exclude)).toBe(true);
			expect(query.terms.length).toBeGreaterThan(0);
		},
	);

	test("closes an unclosed quote at the end of the text", () => {
		expect(parsed(`"route pattern`).terms).toEqual([
			{ text: "route pattern", phrase: true, prefix: false, exclude: false },
		]);
	});

	test("keeps a quote inside a word as part of the word", () => {
		expect(parsed(`foo"bar`).terms[0]?.text).toBe(`foo"bar`);
	});

	test("collapses whitespace inside a phrase", () => {
		expect(parsed(`"  route \t pattern  "`).terms[0]?.text).toBe("route pattern");
	});

	test("excludes a phrase", () => {
		expect(parsed(`remix -"old api"`).terms[1]).toEqual({
			text: "old api",
			phrase: true,
			prefix: false,
			exclude: true,
		});
	});

	test("drops terms holding no letter or number", () => {
		expect(parsed(`remix ++ "--" - *`).terms.map((term) => term.text)).toEqual(["remix"]);
	});

	test("NFKC-normalizes the text first", () => {
		expect(parsed("ｒｅｍｉｘ").terms[0]?.text).toBe("remix");
	});

	test("prefixes only the last word with prefix: last", () => {
		let terms = parsed("route pat", { prefix: "last" }).terms;
		expect(terms.map((term) => term.prefix)).toEqual([false, true]);
	});

	test("prefixes nothing with prefix: none, except a starred word", () => {
		let terms = parsed("route pat*", { prefix: "none" }).terms;
		expect(terms.map((term) => term.prefix)).toEqual([false, true]);
	});

	test("refuses a query with nothing left to find", () => {
		for (let input of ["-legacy", "-a -b", "++", `""`]) {
			let result = parseQuery(input);
			expect(isFailure(result) && result.error).toBeInstanceOf(ValidationError);
		}
	});

	test("refuses a query longer than maxLength", () => {
		expect(isFailure(parseQuery("x".repeat(257)))).toBe(true);
		expect(isFailure(parseQuery("x".repeat(256)))).toBe(false);
		expect(isFailure(parseQuery("abcdef", { maxLength: 5 }))).toBe(true);
	});

	test("refuses a query with more terms than maxTerms", () => {
		expect(isFailure(parseQuery("a b c d e f g h i"))).toBe(true);
		expect(isFailure(parseQuery("a b c d e f g h"))).toBe(false);
		expect(isFailure(parseQuery("a b c", { maxTerms: 2 }))).toBe(true);
	});

	test("names the query parameter in the issue", () => {
		let result = parseQuery("-legacy");
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.issues[0]?.path).toEqual(["q"]);
	});
});

describe("highlight", () => {
	test("marks words and phrases, and leaves the rest as written", () => {
		expect(highlight("Remix Route Pattern basics", parsed(`remix "route pattern"`))).toEqual([
			{ text: "Remix", match: true },
			{ text: " ", match: false },
			{ text: "Route Pattern", match: true },
			{ text: " basics", match: false },
		]);
	});

	test("matches a prefix and marks the whole word", () => {
		expect(highlight("Using SQLite at the edge", parsed("sql"))).toEqual([
			{ text: "Using ", match: false },
			{ text: "SQLite", match: true },
			{ text: " at the edge", match: false },
		]);
	});

	test("matches only whole words for a phrase or a word without prefix", () => {
		let query = parsed("sql", { prefix: "none" });
		expect(highlight("SQLite and SQL", query)).toEqual([
			{ text: "SQLite and ", match: false },
			{ text: "SQL", match: true },
		]);
	});

	test("ignores case and diacritics, and keeps the text as written", () => {
		expect(highlight("Mi Résumé", parsed("resume"))).toEqual([
			{ text: "Mi ", match: false },
			{ text: "Résumé", match: true },
		]);
	});

	test("keeps a decomposed accent with its letter", () => {
		let text = "café time";
		let segments = highlight(text, parsed("cafe", { prefix: "none" }));
		expect(segments[0]).toEqual({ text: "café", match: true });
		expect(segments.map((segment) => segment.text).join("")).toBe(text);
	});

	test("never marks an excluded term", () => {
		expect(highlight("remix legacy", parsed("remix -legacy"))).toEqual([
			{ text: "remix", match: true },
			{ text: " legacy", match: false },
		]);
	});

	test("treats punctuation in a term as a word boundary, as the tokenizer does", () => {
		expect(highlight("It's here", parsed("it's"))).toEqual([
			{ text: "It's", match: true },
			{ text: " here", match: false },
		]);
	});

	test("matches anywhere in substring mode", () => {
		expect(highlight("PostgreSQL", parsed("gres"), { mode: "substring" })).toEqual([
			{ text: "Post", match: false },
			{ text: "greS", match: true },
			{ text: "QL", match: false },
		]);
	});

	test("merges overlapping matches", () => {
		expect(highlight("remix router", parsed(`remix "remix router"`))).toEqual([
			{ text: "remix router", match: true },
		]);
	});

	test("answers no segments for empty text", () => {
		expect(highlight("", parsed("remix"))).toEqual([]);
	});
});

describe("excerpt", () => {
	let words = Array.from({ length: 60 }, (_, index) => `word${index}`);

	test("opens a window around the first match", () => {
		let text = [...words.slice(0, 30), "Remix", ...words.slice(30)].join(" ");
		let cut = excerpt(text, parsed("remix", { prefix: "none" }), { words: 8 });

		expect(cut.truncatedStart).toBe(true);
		expect(cut.truncatedEnd).toBe(true);
		expect(cut.segments.map((segment) => segment.text).join("")).toBe(
			"word28 word29 Remix word30 word31 word32 word33 word34",
		);
		expect(cut.segments.find((segment) => segment.match)?.text).toBe("Remix");
	});

	test("opens at the start when nothing matches", () => {
		let cut = excerpt(words.join(" "), parsed("absent"), { words: 3 });
		expect(cut.segments).toEqual([{ text: "word0 word1 word2", match: false }]);
		expect(cut.truncatedStart).toBe(false);
		expect(cut.truncatedEnd).toBe(true);
	});

	test("keeps the window full near the end of the text", () => {
		let cut = excerpt(words.join(" "), parsed("word59", { prefix: "none" }), { words: 4 });
		expect(cut.segments.map((segment) => segment.text).join("")).toBe(
			"word56 word57 word58 word59",
		);
		expect(cut.truncatedEnd).toBe(false);
	});

	test("answers the whole text when it is shorter than the window", () => {
		let cut = excerpt("short remix text", parsed("remix"));
		expect(cut.truncatedStart).toBe(false);
		expect(cut.truncatedEnd).toBe(false);
		expect(cut.segments.map((segment) => segment.text).join("")).toBe("short remix text");
	});
});
