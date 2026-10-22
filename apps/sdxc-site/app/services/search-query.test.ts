/**
 * Tests for the ranking the search dialog, `/search` and the MCP search tool all share.
 * The ordering is the whole product here: a reader who types two words expects the second
 * to narrow rather than widen, and a name typed in full expects to come first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import type { SearchDocument } from "~/app/services/search-query";

import { kindNamed, rankDocuments } from "~/app/services/search-query";

const DOCUMENTS: SearchDocument[] = [
	{
		href: "/api/markdown",
		title: "@sdxc/markdown",
		page: "@sdxc/markdown",
		section: "Packages · Content & formats",
		kind: "api",
		summary: "GFM to a typed AST you can walk, transform and write back.",
	},
	{
		href: "/api/markdown#parsing",
		title: "Parsing",
		page: "@sdxc/markdown",
		section: "Packages · Content & formats",
		kind: "api",
	},
	{
		href: "/api/yaml#parsing",
		title: "Parsing",
		page: "@sdxc/yaml",
		section: "Packages · Content & formats",
		kind: "api",
	},
	{
		href: "/docs/conventions/naming",
		title: "Naming",
		page: "Naming",
		section: "Conventions",
		kind: "guide",
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
		expect(narrow.map((document) => document.href)).toEqual(["/api/yaml#parsing"]);
	});

	test("finds a page by what its summary says rather than by its name", () => {
		let results = rankDocuments(DOCUMENTS, "typed ast", 10);

		expect(results.map((document) => document.href)).toEqual(["/api/markdown"]);
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
				kind: "guide",
			},
			{
				href: "/package",
				title: "@sdxc/result",
				page: "@sdxc/result",
				section: "Packages",
				kind: "api",
			},
		];

		expect(rankDocuments(documents, "result", 10).at(0)?.href).toBe("/package");
	});

	test("matches where a word starts, so a short word does not land inside a longer one", () => {
		let documents: SearchDocument[] = [
			{
				href: "/a",
				title: "Pattern: A Validated Form",
				page: "@sdxc/ui",
				section: "Packages",
				kind: "ui",
			},
			{
				href: "/b",
				title: "Dated versions",
				page: "Versioning",
				section: "Releases",
				kind: "guide",
			},
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

describe("search syntax", () => {
	test("narrows to a kind with kind:", () => {
		let results = rankDocuments(DOCUMENTS, "naming kind:guide", 10);

		expect(results.map((document) => document.href)).toEqual(["/docs/conventions/naming"]);
		expect(rankDocuments(DOCUMENTS, "naming kind:api", 10)).toEqual([]);
	});

	test("leaves a kind out with -kind:", () => {
		let results = rankDocuments(DOCUMENTS, "naming OR parsing -kind:api", 10);

		expect(results.map((document) => document.kind)).toEqual(["guide"]);
	});

	test("lists a kind alone in the corpus order", () => {
		let results = rankDocuments(DOCUMENTS, "kind:packages", 10);

		expect(results.map((document) => document.href)).toEqual([
			"/api/markdown",
			"/api/markdown#parsing",
			"/api/yaml#parsing",
		]);
	});

	test("leaves out an entry holding an excluded word", () => {
		let results = rankDocuments(DOCUMENTS, "parsing -yaml", 10);

		expect(results.map((document) => document.href)).toEqual(["/api/markdown#parsing"]);
	});

	test("accepts either word joined by OR", () => {
		let results = rankDocuments(DOCUMENTS, "naming OR yaml", 10);

		expect(results.map((document) => document.href).sort()).toEqual([
			"/api/yaml#parsing",
			"/docs/conventions/naming",
		]);
	});

	test("reads a kind by its tab's name or plural, case-blind", () => {
		expect(kindNamed("Guides")).toBe("guide");
		expect(kindNamed("components")).toBe("ui");
		expect(kindNamed("utilities")).toBe("u");
		expect(kindNamed("posts")).toBeNull();
	});
});
