/**
 * Tests for the states the search dialog and the `/search` page render: the dialog's tabs,
 * its fallback to "All" for a tab that emptied, its limit, and the page's paging.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ParsedQuery } from "@sdxc/search/query";

import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SearchDocument } from "~/app/services/search-query";

import { matchDocuments, parseSearch } from "~/app/services/search-query";
import { SearchResults } from "~/app/services/search-results";

const DOCUMENTS: SearchDocument[] = [
	{ href: "/docs/forms", title: "Forms", page: "Forms", section: "Guides", kind: "guide" },
	{
		href: "/api/form-data",
		title: "@sdxc/form-data",
		page: "@sdxc/form-data",
		section: "Packages",
		kind: "api",
	},
	{
		href: "/api/ui/form",
		title: "Form",
		page: "Form",
		section: "@sdxc/ui · Components",
		kind: "ui",
	},
	{
		href: "/api/ui/form-field",
		title: "FormField",
		page: "FormField",
		section: "@sdxc/ui · Components",
		kind: "ui",
	},
];

/** The parsed query for `text`, which every case here expects to run. */
function parsed(text: string): ParsedQuery {
	let result = parseSearch(text);
	if (!isSuccess(result) || result.data === null) throw new Error(`"${text}" did not parse`);
	return result.data;
}

/** The dialog's state for `text` on the tab `kind`, listing at most `limit` rows. */
function suggest(text: string, kind: SearchDocument["kind"] | null, limit = 10) {
	let query = parsed(text);
	return SearchResults.suggestions({
		query: text,
		parsed: query,
		matches: matchDocuments(DOCUMENTS, query),
		kind,
		limit,
	});
}

describe("SearchResults.suggestions", () => {
	test("offers All and a tab per kind with matches, each with its count", () => {
		let model = suggest("form", null);

		expect(
			model.state === "results" ? model.tabs.map((tab) => [tab.label, tab.count]) : null,
		).toEqual([
			["All", 4],
			["Guides", 1],
			["API", 1],
			["UI", 2],
		]);
	});

	test("narrows the rows to the tab asked for, and links See all to that kind", () => {
		let model = suggest("form", "ui");

		expect(model.state === "results" ? model.items.map((item) => item.href) : null).toEqual([
			"/api/ui/form",
			"/api/ui/form-field",
		]);
		expect(model.state === "results" ? model.seeAll : null).toBe("/search?q=form+kind%3Aui");
	});

	test("falls back to All for a tab with no matches", () => {
		let model = suggest("form", "u");

		expect(model.state === "results" ? model.kind : "unset").toBeNull();
		expect(model.state === "results" ? model.items : []).toHaveLength(4);
	});

	test("lists at most the limit, while the total counts every match", () => {
		let model = suggest("form", null, 2);

		expect(model.state === "results" ? [model.items.length, model.total] : null).toEqual([2, 4]);
	});

	test("shows no tabs while one kind holds every match", () => {
		let model = suggest("formfield", null);

		expect(model.state === "results" ? model.tabs : null).toEqual([]);
	});

	test("marks the matched words in the title", () => {
		let model = suggest("forms", null);

		expect(model.state === "results" ? model.items[0]?.title : null).toEqual([
			{ text: "Forms", match: true },
		]);
	});
});

/** A guide page and two of its headings, plus a heading whose page did not match. */
const GROUPED: SearchDocument[] = [
	{
		href: "/docs/forms#validate",
		title: "Validate a form",
		page: "Forms",
		section: "Guides",
		kind: "guide",
	},
	{
		href: "/docs/forms",
		title: "Forms",
		page: "Forms",
		section: "Guides",
		kind: "guide",
		summary: "Submit and validate forms",
	},
	{
		href: "/docs/actions#form-errors",
		title: "Form errors",
		page: "Actions",
		section: "Guides",
		kind: "guide",
	},
	{
		href: "/docs/forms#form-fields",
		title: "Form fields",
		page: "Forms",
		section: "Guides",
		kind: "guide",
	},
];

/** The dialog's rows for `text` over {@link GROUPED}, as `[href, nested]` pairs. */
function groupedRows(text: string, limit = 10) {
	let query = parsed(text);
	let model = SearchResults.suggestions({
		query: text,
		parsed: query,
		matches: matchDocuments(GROUPED, query),
		kind: null,
		limit,
	});
	return model.state === "results"
		? { rows: model.items.map((item) => [item.href, item.nested]), listed: model.listed }
		: null;
}

describe("SearchResults.suggestions grouping", () => {
	test("lists each page's row first, then its headings nested under it", () => {
		expect(groupedRows("form")?.rows).toEqual([
			["/docs/forms", false],
			["/docs/forms#form-fields", true],
			["/docs/forms#validate", true],
			["/docs/actions", false],
			["/docs/actions#form-errors", true],
		]);
	});

	test("names a page that only its headings matched after the page and its section", () => {
		let query = parsed("errors");
		let model = SearchResults.suggestions({
			query: "errors",
			parsed: query,
			matches: matchDocuments(GROUPED, query),
			kind: null,
			limit: 10,
		});
		let page = model.state === "results" ? model.items[0] : undefined;

		expect(page?.href).toBe("/docs/actions");
		expect(page?.title).toEqual([{ text: "Actions", match: false }]);
		expect(page?.description).toEqual([{ text: "Guides", match: false }]);
	});

	test("fills the row budget with whole matches, a heading's page row included", () => {
		expect(groupedRows("form", 3)).toEqual({
			rows: [
				["/docs/forms", false],
				["/docs/actions", false],
				["/docs/actions#form-errors", true],
			],
			listed: 2,
		});
	});
});

describe("SearchResults.suggestions descriptions", () => {
	test("unwraps the summary's code spans, so no backtick reaches the row", () => {
		let documents: SearchDocument[] = [
			{
				href: "/api/ui/form",
				title: "Form",
				page: "Form",
				section: "@sdxc/ui · Components",
				kind: "ui",
				summary: "Wraps a native `<form>` element",
			},
		];
		let query = parsed("form");
		let model = SearchResults.suggestions({
			query: "form",
			parsed: query,
			matches: matchDocuments(documents, query),
			kind: null,
			limit: 10,
		});
		let description = model.state === "results" ? model.items[0]?.description : [];

		expect(description?.map((segment) => segment.text).join("")).toBe(
			"Wraps a native <form> element",
		);
	});
});

describe("SearchResults.suggestions with no matches", () => {
	test("points at the kinds the words reach once the kind filter is dropped", () => {
		let filtered = parsed("form kind:u");
		let model = SearchResults.suggestions({
			query: "form kind:u",
			parsed: filtered,
			matches: matchDocuments(DOCUMENTS, filtered),
			kind: null,
			limit: 10,
			unfiltered: matchDocuments(DOCUMENTS, { ...filtered, filters: [] }),
		});

		expect(
			model.state === "results"
				? model.elsewhere.map((tab) => [tab.label, tab.count, tab.href])
				: null,
		).toEqual([
			["Guides", 1, "/search?q=form+kind%3Aguide"],
			["API", 1, "/search?q=form+kind%3Aapi"],
			["UI", 2, "/search?q=form+kind%3Aui"],
		]);
	});

	test("offers no other kinds while the query has matches", () => {
		let model = suggest("form", null);

		expect(model.state === "results" ? model.elsewhere : null).toEqual([]);
	});
});

describe("SearchResults.results", () => {
	test("pages every match and keeps the query in the pager's links", () => {
		let query = parsed("form");
		let model = SearchResults.results({
			query: "form",
			parsed: query,
			matches: matchDocuments(DOCUMENTS, query),
			page: 2,
			perPage: 3,
			url: new URL("https://sdxc.dev/search?q=form&page=2"),
		});

		expect(model.state === "results" ? [model.from, model.to, model.total] : null).toEqual([
			4, 4, 4,
		]);
		expect(model.state === "results" ? model.pager?.prev : null).toBe("/search?q=form&page=1");
	});
});
