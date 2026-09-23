/**
 * Tests for the search corpus. The index is read by a line scan rather than a parse, so
 * these assertions are what keep it agreeing with the pages themselves: an anchor that
 * does not exist on the page is a result that lands in the wrong place, and a heading
 * scanned out of a fenced shell sample is a result for something nobody wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { prepareArticle, tableOfContents } from "~/app/services/article";
import { listGuides, MARKDOWN_OPTIONS, readGuide } from "~/app/services/docs";
import { listPackages } from "~/app/services/packages";
import { buildSearchIndex, searchDocs, searchPackages } from "~/app/services/search";

describe("buildSearchIndex", () => {
	test("carries one entry per page, with the summary its author wrote", async () => {
		let documents = await buildSearchIndex();
		let pages = new Set(documents.filter((entry) => entry.summary).map((entry) => entry.href));

		/* The two catalogues answer on their own trees, so search carries every other package. */
		for (let entry of listPackages()) {
			if (entry.directory === "u" || entry.directory === "ui") {
				expect(pages).not.toContain(`/docs/packages/${entry.directory}`);
				continue;
			}

			expect(pages).toContain(`/docs/packages/${entry.directory}`);
		}

		for (let section of await listGuides()) {
			for (let guide of section.guides) expect(pages).toContain(`/docs/${guide.slug}`);
		}
	});

	test("gives a heading the anchor the rendered page gives it", async () => {
		let source = await readGuide("releases/versioning");
		expect(source).not.toBeNull();

		let parsed = Markdown.parse(source ?? "", MARKDOWN_OPTIONS);
		expect(isSuccess(parsed)).toBe(true);
		if (!isSuccess(parsed)) return;

		let prepared = prepareArticle(parsed.data.document);
		expect(isSuccess(prepared)).toBe(true);
		if (!isSuccess(prepared)) return;

		let rendered = tableOfContents(prepared.data).map((anchor) => anchor.id);
		let indexed = (await buildSearchIndex())
			.filter((entry) => entry.href.startsWith("/docs/releases/versioning#"))
			.map((entry) => entry.href.split("#").at(1));

		expect(indexed).toEqual(rendered);
	});

	test("leaves the npm boilerplate a package page drops out of the index", async () => {
		let documents = await buildSearchIndex();
		let titles = documents
			.filter((entry) => entry.href.startsWith("/docs/packages/result#"))
			.map((entry) => entry.title);

		expect(titles.length).toBeGreaterThan(0);
		expect(titles).not.toContain("Versioning");
		expect(titles).not.toContain("License");
		expect(titles).not.toContain("Author");
	});
});

describe("searchDocs", () => {
	test("answers a question about a package with that package's own page", async () => {
		let results = await searchDocs("markdown", 5);

		expect(results.at(0)?.href).toBe("/docs/packages/markdown");
	});
});

describe("searchPackages", () => {
	test("finds a package by what it does rather than by its name", async () => {
		let results = await searchPackages("syndication feeds", 5);

		expect(results.map((match) => match.name)).toContain("@sdxc/feed");
	});

	test("names the page and its markdown twin, so a reader has both", async () => {
		let [first] = await searchPackages("result", 1);

		expect(first?.href).toBe("/docs/packages/result");
		expect(first?.markdownHref).toBe("/docs/packages/result.md");
	});

	test("puts a package named by the query above one that only mentions it", async () => {
		let results = await searchPackages("opml", 5);

		expect(results.at(0)?.name).toBe("@sdxc/opml");
	});
});
