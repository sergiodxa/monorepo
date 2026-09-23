/**
 * Tests for the ranking the palette, `/search.json` and the MCP search tool all share.
 * The ordering is the whole product here: a reader who types two words expects the second
 * to narrow rather than widen, and a name typed in full expects to come first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { SearchDocument } from "~/app/services/search-query";

import { rankDocuments } from "~/app/services/search-query";

const DOCUMENTS: SearchDocument[] = [
	{
		href: "/docs/packages/markdown",
		title: "@sdxc/markdown",
		page: "@sdxc/markdown",
		section: "Packages · Content & formats",
		summary: "GFM to a typed AST you can walk, transform and write back.",
	},
	{
		href: "/docs/packages/markdown#parsing",
		title: "Parsing",
		page: "@sdxc/markdown",
		section: "Packages · Content & formats",
	},
	{
		href: "/docs/packages/yaml#parsing",
		title: "Parsing",
		page: "@sdxc/yaml",
		section: "Packages · Content & formats",
	},
	{
		href: "/docs/conventions/naming",
		title: "Naming",
		page: "Naming",
		section: "Conventions",
		summary: "What a package name tells you, and the conventions its exports follow.",
	},
];

describe("rankDocuments", () => {
	test("puts a title matched whole above one it only appears inside", () => {
		let [first] = rankDocuments(DOCUMENTS, "parsing", 10);

		expect(first?.title).toBe("Parsing");
	});

	test("narrows on a second word rather than widening", () => {
		let wide = rankDocuments(DOCUMENTS, "parsing", 10);
		let narrow = rankDocuments(DOCUMENTS, "parsing yaml", 10);

		expect(wide.length).toBe(2);
		expect(narrow.map((document) => document.href)).toEqual(["/docs/packages/yaml#parsing"]);
	});

	test("finds a page by what its summary says rather than by its name", () => {
		let results = rankDocuments(DOCUMENTS, "typed ast", 10);

		expect(results.map((document) => document.href)).toEqual(["/docs/packages/markdown"]);
	});

	test("ignores case on both sides", () => {
		expect(rankDocuments(DOCUMENTS, "NAMING", 10).at(0)?.title).toBe("Naming");
	});

	test("answers a package's own name typed without its scope", () => {
		let documents: SearchDocument[] = [
			{
				href: "/guide",
				title: "Result everywhere",
				page: "Result everywhere",
				section: "Conventions",
			},
			{ href: "/package", title: "@sdxc/result", page: "@sdxc/result", section: "Packages" },
		];

		expect(rankDocuments(documents, "result", 10).at(0)?.href).toBe("/package");
	});

	test("matches where a word starts, so a short word does not land inside a longer one", () => {
		let documents: SearchDocument[] = [
			{ href: "/a", title: "Pattern: A Validated Form", page: "@sdxc/ui", section: "Packages" },
			{ href: "/b", title: "Dated versions", page: "Versioning", section: "Releases" },
		];

		expect(rankDocuments(documents, "dated", 10).map((entry) => entry.href)).toEqual(["/b"]);
	});

	test("answers an empty query with the corpus in its own order", () => {
		expect(rankDocuments(DOCUMENTS, "   ", 2)).toEqual(DOCUMENTS.slice(0, 2));
	});

	test("returns nothing when a word reaches no entry", () => {
		expect(rankDocuments(DOCUMENTS, "parsing kubernetes", 10)).toEqual([]);
	});

	test("never returns more than it was asked for", () => {
		expect(rankDocuments(DOCUMENTS, "parsing", 1)).toHaveLength(1);
	});
});
