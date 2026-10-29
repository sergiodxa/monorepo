/**
 * Tests for the search corpus, held against the pages themselves: an anchor that does
 * not exist on the page is a result that lands in the wrong place, so every fragment the
 * index links to is compared with the ids the rendered page carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { prepareArticle, preparePackageReadme, tableOfContents } from "~/app/services/article";
import { listGuides, MARKDOWN_OPTIONS, readGuide } from "~/app/services/docs";
import { listPackages, readPackageReadme } from "~/app/services/packages";
import { buildSearchIndex, searchDocs, searchPackages } from "~/app/services/search";

describe("buildSearchIndex", () => {
	test("carries one entry per page, with the summary its author wrote", async () => {
		let documents = await buildSearchIndex();
		let pages = new Set(documents.filter((entry) => entry.summary).map((entry) => entry.href));

		for (let entry of listPackages()) expect(pages).toContain(`/api/${entry.directory}`);

		for (let section of await listGuides()) {
			for (let guide of section.guides) expect(pages).toContain(`/docs/${guide.slug}`);
		}
	});

	test("carries no README heading for a catalogue, whose page draws an index instead", async () => {
		let documents = await buildSearchIndex();

		for (let directory of ["u", "ui"]) {
			expect(documents.some((entry) => entry.href.startsWith(`/api/${directory}#`))).toBe(false);
		}
	});

	test("links every heading to the id its rendered page gives it", async () => {
		let documents = await buildSearchIndex();

		/** The fragments the index links to on one page, in index order. */
		function fragments(page: string): Array<string | undefined> {
			return documents
				.filter((entry) => entry.href.startsWith(`${page}#`))
				.map((entry) => entry.href.split("#").at(1));
		}

		for (let section of await listGuides()) {
			for (let guide of section.guides) {
				let parsed = Markdown.parse((await readGuide(guide.slug)) ?? "", MARKDOWN_OPTIONS);
				if (!isSuccess(parsed)) continue;

				let prepared = prepareArticle(parsed.data.document, MARKDOWN_OPTIONS);
				if (!isSuccess(prepared)) continue;

				let rendered = tableOfContents(prepared.data).map((anchor) => anchor.id);
				expect(fragments(`/docs/${guide.slug}`), guide.slug).toEqual(rendered);
			}
		}

		for (let entry of listPackages()) {
			if (entry.directory === "u" || entry.directory === "ui") continue;

			let parsed = Markdown.parse((await readPackageReadme(entry.directory)) ?? "");
			if (!isSuccess(parsed)) continue;

			let prepared = preparePackageReadme(parsed.data.document, entry.directory);
			if (!isSuccess(prepared)) continue;

			let rendered = tableOfContents(prepared.data).map((anchor) => anchor.id);
			expect(fragments(`/api/${entry.directory}`), entry.directory).toEqual(rendered);
		}
	});

	test("leaves the npm boilerplate a package page drops out of the index", async () => {
		let documents = await buildSearchIndex();
		let titles = documents
			.filter((entry) => entry.href.startsWith("/api/result#"))
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

		expect(results.at(0)?.href).toBe("/api/markdown");
	});
});

describe("searchPackages", () => {
	test("finds a package by what it does rather than by its name", async () => {
		let results = await searchPackages("syndication feeds", 5);

		expect(results.map((match) => match.name)).toContain("@sdxc/feed");
	});

	test("names the page and its markdown twin, so a reader has both", async () => {
		let [first] = await searchPackages("result", 1);

		expect(first?.href).toBe("/api/result");
		expect(first?.markdownHref).toBe("/api/result.md");
	});

	test("puts a package named by the query above one that only mentions it", async () => {
		let results = await searchPackages("opml", 5);

		expect(results.at(0)?.name).toBe("@sdxc/opml");
	});
});
