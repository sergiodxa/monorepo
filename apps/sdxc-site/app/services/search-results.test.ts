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
