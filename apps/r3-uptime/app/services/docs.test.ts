/**
 * Tests `listDocs` and `getDocLoader` against the real Markdown files under
 * `resources/docs/**`: sections come back ordered by `section.order`, docs within a
 * section are ordered by their own `order`, a known slug resolves a loader whose
 * content matches the real file, and an unknown slug resolves to `null`. *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { plugin } from "bun";
import { Glob } from "bun";

/**
 * `import.meta.glob` is a Vite build-time feature with no plain-`bun test` equivalent,
 * so this shim patches the one call in `docs.ts` out for a plain object of thunks that
 * resolve real file content read via `node:fs`, before that module is ever imported.
 */
plugin({
	name: "docs-glob-shim",
	setup(build) {
		build.onLoad({ filter: /app\/services\/docs\.ts$/ }, (args) => {
			let source = readFileSync(args.path, "utf8");
			let docsDir = join(dirname(args.path), "../../resources/docs");
			let glob = new Glob("**/*.md");
			let entries: string[] = [];
			for (let file of glob.scanSync({ cwd: docsDir })) entries.push(file);
			let objectEntries = entries.map((rel) => {
				let content = readFileSync(join(docsDir, rel), "utf8");
				let key = `../../resources/docs/${rel}`;
				return `${JSON.stringify(key)}: () => Promise.resolve(${JSON.stringify(content)})`;
			});
			let replacement = `const docFileLoaders = {${objectEntries.join(",")}};`;
			let patched = source.replace(
				/const docFileLoaders = import\.meta\.glob<string>\(\s*"\.\.\/\.\.\/resources\/docs\/\*\*\/\*\.md",\s*\{[\s\S]*?\}\s*\);/,
				replacement,
			);
			if (patched === source) {
				throw new Error(
					"glob shim: replacement pattern did not match — check docs.ts hasn't changed shape",
				);
			}
			return { contents: patched, loader: "tsx" };
		});
	},
});

let { listDocs, getDocLoader } = await import("./docs");

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
			"Concepts",
			"Team & Settings",
			"API Reference",
			"API Resources",
		]);

		let orders = sections.map((section) => section.order);
		expect(orders).toEqual([1, 2, 3, 4, 5]);
	});

	test("sorts docs within each section by their own order", async () => {
		let sections = await listDocs();

		let gettingStarted = sections.find((section) => section.title === "Getting Started");
		expect(gettingStarted?.docs.map((doc) => doc.path)).toEqual([
			"/docs/overview",
			"/docs/quickstart",
		]);

		let concepts = sections.find((section) => section.title === "Concepts");
		expect(concepts?.docs.map((doc) => doc.path)).toEqual([
			"/docs/concepts/monitors",
			"/docs/concepts/http-monitors",
			"/docs/concepts/dns-monitors",
			"/docs/concepts/tcp-monitors",
			"/docs/concepts/cron-jobs",
			"/docs/concepts/alerts",
			"/docs/concepts/status-pages",
			"/docs/concepts/maintenance",
		]);

		for (let section of sections) {
			let orders = section.docs.map((doc) => doc.frontmatter.order);
			let sorted = [...orders].sort((a, b) => a - b);
			expect(orders).toEqual(sorted);
		}
	});

	test("includes the real overview doc with its actual frontmatter", async () => {
		let sections = await listDocs();

		let gettingStarted = sections.find((section) => section.title === "Getting Started");
		let overview = gettingStarted?.docs.find((doc) => doc.path === "/docs/overview");

		expect(overview?.frontmatter.title).toBe("Overview");
		expect(overview?.frontmatter.order).toBe(1);
		expect(overview?.frontmatter.section.order).toBe(1);
	});
});

describe("getDocLoader", () => {
	test("resolves a real slug's loader with the real file content", async () => {
		let entry = getDocLoader("overview");

		expect(entry).not.toBeNull();
		expect(entry?.path).toBe("../../resources/docs/overview.md");

		let content = await entry?.loader();
		expect(content).toContain("Uptime continuously monitors your infrastructure");
	});

	test("returns null for an unknown slug", () => {
		expect(getDocLoader("not-a-real-slug")).toBeNull();
	});
});
