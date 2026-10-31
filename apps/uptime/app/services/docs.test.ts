/**
 * Tests `listDocs` and `getDocLoader` against the real Markdown files under
 * `resources/docs/**`: sections come back ordered by `section.order`, docs within a
 * section are ordered by their own `order`, a known slug resolves a loader whose
 * content matches the real file, an unknown slug resolves to `null`, every curated next
 * page exists, and the sidebar tree and page kinds follow the folders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { docKind, findDoc, getDocLoader, listDocs, toDocsTree } from "./docs";

describe("listDocs", () => {
	test("returns non-empty sections", async () => {
		let sections = await listDocs();

		expect(sections.length).toBeGreaterThan(0);
	});

	test("sorts sections by section.order", async () => {
		let sections = await listDocs();

		let titles = sections.map((section) => section.title);
		expect(titles).toEqual([
			"Getting Started",
			"Guides",
			"Fix a problem",
			"Concepts",
			"Team & Settings",
			"API Reference",
			"API Resources",
		]);

		let orders = sections.map((section) => section.order);
		expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	test("sorts docs within each section by their own order", async () => {
		let sections = await listDocs();

		let gettingStarted = sections.find((section) => section.title === "Getting Started");
		expect(gettingStarted?.docs.map((doc) => doc.path)).toEqual(["/docs/quickstart"]);

		let concepts = sections.find((section) => section.title === "Concepts");
		expect(concepts?.docs.map((doc) => doc.path)).toEqual([
			"/docs/concepts/monitors",
			"/docs/concepts/http-monitors",
			"/docs/concepts/dns-monitors",
			"/docs/concepts/tcp-monitors",
			"/docs/concepts/flow-monitors",
			"/docs/concepts/cron-jobs",
			"/docs/concepts/alerts",
			"/docs/concepts/status-pages",
			"/docs/concepts/maintenance",
			"/docs/concepts/reports",
		]);

		for (let section of sections) {
			let orders = section.docs.map((doc) => doc.frontmatter.order);
			let sorted = [...orders].sort((a, b) => a - b);
			expect(orders).toEqual(sorted);
		}
	});

	test("hands every page on only to pages that exist", async () => {
		let sections = await listDocs();

		for (let doc of sections.flatMap((section) => section.docs)) {
			for (let path of doc.frontmatter.next ?? []) {
				expect(findDoc(sections, path), `${doc.path} → ${path}`).not.toBeNull();
			}
		}
	});
});

describe("getDocLoader", () => {
	test("resolves a real slug's loader with the real file content", async () => {
		let entry = getDocLoader("concepts/http-monitors");

		expect(entry).not.toBeNull();
		expect(entry?.path).toBe("../../resources/docs/concepts/http-monitors.md");

		let content = await entry?.loader();
		expect(content).toContain("title: HTTP Monitors");
	});

	test("returns null for an unknown slug", () => {
		expect(getDocLoader("not-a-real-slug")).toBeNull();
	});
});

describe("toDocsTree", () => {
	test("lists every section's pages in sidebar order", async () => {
		let sections = await listDocs();
		let tree = toDocsTree(sections, "Documentation");

		expect(tree.label).toBe("Documentation");
		expect(tree.sections.map((section) => section.title)).toEqual(
			sections.map((section) => section.title),
		);
		expect(tree.sections[0]?.items[0]?.href).toBe(sections[0]?.docs[0]?.path);
	});
});

describe("docKind", () => {
	test("labels a page by the folder it is filed in", () => {
		expect(docKind("/docs/troubleshooting/not-receiving-alerts")).toBe("troubleshooting");
		expect(docKind("/docs/concepts/alerts")).toBe("concept");
		expect(docKind("/docs/api/resources/alerts")).toBe("reference");
		expect(docKind("/docs/guides/add-a-monitor")).toBe("guide");
		expect(docKind("/docs/quickstart")).toBe("guide");
	});
});
