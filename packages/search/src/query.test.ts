/**
 * Tests for `parseQuery`, `highlight` and `excerpt`: the Lucene-style syntax and its lenient
 * fallbacks, the inputs FTS5 rejects as syntax parsed as plain terms, prefix rules and
 * limits, and highlighting mapped back onto the text exactly as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import type { ParsedQuery, SearchClause, SearchTerm } from "./query.js";

import { excerpt, highlight, parseQuery } from "./query.js";

/** Parses a query the test knows is valid and non-blank. */
function parsed(input: string, options?: Parameters<typeof parseQuery>[1]): ParsedQuery {
	let query = unwrap(parseQuery(input, options));
	if (query === null) throw new Error(`expected terms from ${JSON.stringify(input)}`);
	return query;
}

/** A term with the defaults most tests expect: a word, a prefix, in every column. */
function word(text: string, overrides: Partial<SearchTerm> = {}): SearchTerm {
	return { text, phrase: false, prefix: true, field: null, ...overrides };
}

/** A clause of one term. */
function one(term: SearchTerm, exclude = false): SearchClause {
	return { terms: [term], exclude };
}

/** The text of every term, clause by clause, with excluded clauses marked by a leading `-`. */
function shape(query: ParsedQuery): string[] {
	return query.clauses.map(
		(clause) => (clause.exclude ? "-" : "") + clause.terms.map((term) => term.text).join("|"),
	);
}

/** Declared fields and filters the qualifier tests parse with. */
const QUALIFIED = { fields: ["title"], filters: ["tag", "kind"] } as const;

describe("parseQuery", () => {
	test("reads words, phrases, exclusions and a trailing star", () => {
		expect(parsed(`remix "route pattern" -legacy data*`)).toEqual({
			text: `remix "route pattern" -legacy data*`,
			clauses: [
				one(word("remix")),
				one(word("route pattern", { phrase: true, prefix: false })),
				one(word("legacy"), true),
				one(word("data")),
			],
			filters: [],
		});
	});

	test("answers null for a blank box", () => {
		expect(unwrap(parseQuery(""))).toBeNull();
		expect(unwrap(parseQuery("   \n\t"))).toBeNull();
	});

	test.each([
		`foo"`,
		"and",
		"or",
		"not",
		"NEAR",
		"a:b",
		"c++",
		"it's",
		"(x)",
		"x^y",
		"https://x.dev",
	])("reads %s as a plain term", (input) => {
		let query = parsed(input);
		expect(query.clauses.every((clause) => !clause.exclude)).toBe(true);
		expect(query.clauses.length).toBeGreaterThan(0);
	});

	test("closes an unclosed quote at the end of the text", () => {
		expect(parsed(`"route pattern`).clauses).toEqual([
			one(word("route pattern", { phrase: true, prefix: false })),
		]);
	});

	test("keeps a quote inside a word as part of the word", () => {
		expect(shape(parsed(`foo"bar`))).toEqual([`foo"bar`]);
	});

	test("collapses whitespace inside a phrase", () => {
		expect(shape(parsed(`"  route \t pattern  "`))).toEqual(["route pattern"]);
	});

	test("excludes a phrase", () => {
		expect(parsed(`remix -"old api"`).clauses[1]).toEqual(
			one(word("old api", { phrase: true, prefix: false }), true),
		);
	});

	test("drops terms holding no letter or number", () => {
		expect(shape(parsed(`remix ++ "--" - *`))).toEqual(["remix"]);
	});

	test("NFKC-normalizes the text first", () => {
		expect(shape(parsed("ｒｅｍｉｘ"))).toEqual(["remix"]);
	});

	test("prefixes only the last word with prefix: last", () => {
		let terms = parsed("route pat", { prefix: "last" }).clauses.flatMap((clause) => clause.terms);
		expect(terms.map((term) => term.prefix)).toEqual([false, true]);
	});

	test("prefixes nothing with prefix: none, except a starred word", () => {
		let terms = parsed("route pat*", { prefix: "none" }).clauses.flatMap((clause) => clause.terms);
		expect(terms.map((term) => term.prefix)).toEqual([false, true]);
	});

	test("refuses a query with nothing left to find", () => {
		for (let input of ["-legacy", "-a -b", "++", `""`, "NOT legacy", "-tag:remix"]) {
			let result = parseQuery(input, QUALIFIED);
			expect(isFailure(result) && result.error).toBeInstanceOf(ValidationError);
		}
	});

	test("refuses a query longer than maxLength", () => {
		expect(isFailure(parseQuery("x".repeat(257)))).toBe(true);
		expect(isFailure(parseQuery("x".repeat(256)))).toBe(false);
		expect(isFailure(parseQuery("abcdef", { maxLength: 5 }))).toBe(true);
	});

	test("refuses more terms and filter values than maxTerms", () => {
		expect(isFailure(parseQuery("a b c d e f g h i"))).toBe(true);
		expect(isFailure(parseQuery("a b c d e f g h"))).toBe(false);
		expect(isFailure(parseQuery("a OR b c", { maxTerms: 2 }))).toBe(true);
		expect(isFailure(parseQuery("a tag:b tag:c", { ...QUALIFIED, maxTerms: 2 }))).toBe(true);
	});

	test("names the query parameter in the issue", () => {
		let result = parseQuery("-legacy");
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.issues[0]?.path).toEqual(["q"]);
	});

	describe("operators", () => {
		test("joins the terms on each side of OR into one clause", () => {
			expect(shape(parsed("remix OR react router"))).toEqual(["remix|react", "router"]);
			expect(shape(parsed("a OR b OR c d"))).toEqual(["a|b|c", "d"]);
		});

		test("reads NOT as an exclusion", () => {
			expect(shape(parsed("remix NOT legacy"))).toEqual(["remix", "-legacy"]);
			expect(shape(parsed(`remix NOT "old api"`))).toEqual(["remix", "-old api"]);
		});

		test("accepts + and AND as the default", () => {
			expect(shape(parsed("+remix AND router"))).toEqual(["remix", "router"]);
		});

		test("reads operators only in capitals, and never when quoted", () => {
			expect(shape(parsed("remix or react"))).toEqual(["remix", "or", "react"]);
			expect(shape(parsed(`remix "OR" react`))).toEqual(["remix", "OR", "react"]);
			expect(shape(parsed("-OR remix"))).toEqual(["-OR", "remix"]);
		});

		test("falls back to AND where OR cannot apply", () => {
			expect(shape(parsed("OR remix"))).toEqual(["remix"]);
			expect(shape(parsed("remix OR"))).toEqual(["remix"]);
			expect(shape(parsed("remix OR -legacy"))).toEqual(["remix", "-legacy"]);
			expect(shape(parsed("-legacy OR remix"))).toEqual(["-legacy", "remix"]);
			expect(shape(parsed("remix OR OR react"))).toEqual(["remix|react"]);
			expect(shape(parsed("remix OR ++ OR react"))).toEqual(["remix|react"]);
		});

		test("lets an OR group mix phrases and words", () => {
			expect(parsed(`"route pattern" OR router`).clauses).toEqual([
				{
					terms: [word("route pattern", { phrase: true, prefix: false }), word("router")],
					exclude: false,
				},
			]);
		});
	});

	describe("fields and filters", () => {
		test("scopes a term to a declared field", () => {
			expect(parsed(`title:remix title:"route pattern"`, QUALIFIED).clauses).toEqual([
				one(word("remix", { field: "title" })),
				one(word("route pattern", { phrase: true, prefix: false, field: "title" })),
			]);
		});

		test("reads a declared filter's exact value, untokenized", () => {
			expect(parsed(`remix tag:"React Router" kind:tutorial tag:c++`, QUALIFIED).filters).toEqual([
				{ name: "tag", values: ["React Router"], exclude: false },
				{ name: "kind", values: ["tutorial"], exclude: false },
				{ name: "tag", values: ["c++"], exclude: false },
			]);
		});

		test("accepts a query made only of filters", () => {
			let query = parsed("tag:remix", QUALIFIED);
			expect(query.clauses).toEqual([]);
			expect(query.filters).toEqual([{ name: "tag", values: ["remix"], exclude: false }]);
		});

		test("excludes and alternates filters like terms", () => {
			expect(parsed("remix -tag:legacy tag:a OR tag:b", QUALIFIED).filters).toEqual([
				{ name: "tag", values: ["legacy"], exclude: true },
				{ name: "tag", values: ["a", "b"], exclude: false },
			]);
		});

		test("matches declared names case-insensitively and lowercases them", () => {
			let query = parsed("Title:remix TAG:x", QUALIFIED);
			expect(query.clauses[0]?.terms[0]?.field).toBe("title");
			expect(query.filters[0]?.name).toBe("tag");
		});

		test("keeps an undeclared or empty qualifier as text", () => {
			expect(shape(parsed("body:remix https://x.dev tag:", QUALIFIED))).toEqual([
				"body:remix",
				"https://x.dev",
				"tag:",
			]);
		});

		test("reads OR between a filter and a term as AND", () => {
			let query = parsed("tag:remix OR react", QUALIFIED);
			expect(shape(query)).toEqual(["react"]);
			expect(query.filters).toEqual([{ name: "tag", values: ["remix"], exclude: false }]);
		});

		test("keeps OR between different filters as AND", () => {
			expect(parsed("tag:a OR kind:b", QUALIFIED).filters).toEqual([
				{ name: "tag", values: ["a"], exclude: false },
				{ name: "kind", values: ["b"], exclude: false },
			]);
		});

		test("joins scoped and unscoped terms with OR", () => {
			expect(shape(parsed("title:remix OR react", QUALIFIED))).toEqual(["remix|react"]);
		});
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

	test("marks every alternative of an OR", () => {
		expect(highlight("Remix and React", parsed("remix OR react"))).toEqual([
			{ text: "Remix", match: true },
			{ text: " and ", match: false },
			{ text: "React", match: true },
		]);
	});

	test("marks a scoped term only in the field it names", () => {
		let query = parsed("title:remix router", { fields: ["title"] });
		expect(highlight("Remix router", query, { field: "title" })).toEqual([
			{ text: "Remix", match: true },
			{ text: " ", match: false },
			{ text: "router", match: true },
		]);
		expect(highlight("Remix router", query, { field: "body" })).toEqual([
			{ text: "Remix ", match: false },
			{ text: "router", match: true },
		]);
		expect(highlight("Remix router", query)).toEqual([
			{ text: "Remix ", match: false },
			{ text: "router", match: true },
		]);
	});

	test("never marks a filter value", () => {
		let query = parsed("remix tag:react", { filters: ["tag"] });
		expect(highlight("Remix with React", query)).toEqual([
			{ text: "Remix", match: true },
			{ text: " with React", match: false },
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
