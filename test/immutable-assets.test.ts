/**
 * Guards that every app, and the template `sdxc create` scaffolds, serves its build's hashed
 * files with a year-long immutable `Cache-Control`, so a page view reuses them without a
 * revalidation request each, while unhashed files keep Cloudflare's revalidating default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

/** Repo root, resolved from this file so the scan targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/**
 * Every project Vite builds into Workers Static Assets. Vite copies `public/` into the assets
 * root, where both `cf deploy` and `wrangler deploy` read `_headers`.
 */
const PROJECTS = [
	"apps/sdxc-site",
	"apps/uptime",
	"apps/blog",
	"apps/books",
	"apps/reader",
	"packages/kit/templates/app",
];

/** The header a content-hashed file is served with. */
const IMMUTABLE = "Cache-Control: public, max-age=31536000, immutable";

/**
 * Reads a `_headers` file into its rules, dropping comments and blank lines: a path line opens
 * a rule and each indented line after it adds a header.
 *
 * @param source The file's text.
 * @returns Each rule's path pattern and its headers, in file order.
 */
function parseHeaders(source: string): { path: string; headers: string[] }[] {
	let rules: { path: string; headers: string[] }[] = [];
	for (let line of source.split("\n")) {
		if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
		if (/^\s/.test(line)) rules.at(-1)?.headers.push(line.trim());
		else rules.push({ path: line.trim(), headers: [] });
	}
	return rules;
}

describe("hashed build files are cached as immutable", () => {
	test("the parser reads path lines, their indented headers and skips comments", () => {
		let source = ["# note", "/a/*", "  X-One: 1", "", "/b", "  X-Two: 2", "  X-Three: 3"].join(
			"\n",
		);

		expect(parseHeaders(source)).toEqual([
			{ path: "/a/*", headers: ["X-One: 1"] },
			{ path: "/b", headers: ["X-Two: 2", "X-Three: 3"] },
		]);
	});

	test.each(PROJECTS)("%s marks only /assets/* immutable", (project) => {
		let file = join(ROOT, project, "public/_headers");
		expect(existsSync(file)).toBe(true);

		let immutable = parseHeaders(readFileSync(file, "utf8")).filter((rule) =>
			rule.headers.some((header) => header.includes("immutable")),
		);
		expect(immutable).toEqual([{ path: "/assets/*", headers: [IMMUTABLE] }]);
	});

	test.each(PROJECTS)("%s keeps /assets/ to the files Vite hashes", (project) => {
		expect(existsSync(join(ROOT, project, "public/assets"))).toBe(false);
	});
});
