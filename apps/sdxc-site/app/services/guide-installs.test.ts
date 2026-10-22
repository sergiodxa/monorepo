/**
 * Holds every guide to what a reader can install from npm: code imports each package by its
 * own `@sdxc/<name>`, and the guide's install line names the packages that code imports, so
 * copying a guide top to bottom gives a project that resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

/** The folder every guide is read from. */
const DOCS = fileURLToPath(new URL("../../resources/docs/", import.meta.url));

/** Packages a guide installs as dev dependencies, on a line of their own. */
const DEV_PACKAGES = new Set(["@sdxc/cloudflare-mocks", "@sdxc/jsdoc", "@sdxc/spec"]);

/** Every guide as its path under `resources/docs` and its source. */
const GUIDES = readdirSync(DOCS, { recursive: true, encoding: "utf8" })
	.filter((path) => path.endsWith(".md"))
	.map((path) => ({ path, source: readFileSync(`${DOCS}${path}`, "utf8") }));

/** One fenced code block of a guide, with the language its fence names. */
interface Fence {
	language: string;
	code: string;
}

/** Splits a guide's fenced code blocks out of its prose, in source order. */
function fences(source: string): Fence[] {
	let blocks: Fence[] = [];
	let open: Fence | null = null;
	for (let line of source.split("\n")) {
		let marker = /^\s*```(\S*)/.exec(line);
		if (marker === null) {
			if (open !== null) open.code += `${line}\n`;
		} else if (open === null) {
			open = { language: marker[1] ?? "", code: "" };
		} else {
			blocks.push(open);
			open = null;
		}
	}
	return blocks;
}

/** The arguments of each `npm add` in a guide's shell blocks, continuation lines joined. */
function installs(source: string): string[][] {
	return fences(source)
		.filter((fence) => fence.language === "bash")
		.flatMap((fence) => fence.code.replaceAll(/\\\n\s*/g, " ").split("\n"))
		.filter((line) => line.startsWith("npm add "))
		.map((line) => line.split(/\s+/).slice(2).filter(Boolean));
}

/** The `@sdxc` packages a guide's code imports, by package name without subpath. */
function importedPackages(source: string): Set<string> {
	let names = new Set<string>();
	for (let fence of fences(source)) {
		if (["bash", "json", "text"].includes(fence.language)) continue;
		for (let match of fence.code.matchAll(/["'](@sdxc\/[a-z0-9-]+)[/"']/g)) {
			if (match[1] !== undefined) names.add(match[1]);
		}
	}
	return names;
}

describe("guides", () => {
	test.each(GUIDES)("$path imports each package by its own name", ({ source }) => {
		let code = fences(source)
			.filter((fence) => fence.language !== "bash")
			.map((fence) => fence.code)
			.join("\n");

		expect(code).not.toMatch(/["']sdxc(\/[^"']*)?["']/);
	});

	test.each(GUIDES)("$path installs packages by their own name", ({ source }) => {
		for (let install of installs(source)) {
			if (install.includes("-g")) continue;
			expect(install).not.toContain("sdxc");
		}
	});

	test.each(GUIDES)("$path installs every package its code imports", ({ source }) => {
		let runtime = installs(source).filter(
			(install) => !install.includes("-g") && !install.includes("-D"),
		);
		if (runtime.length === 0) return;

		let installed = new Set(runtime.flat());
		let missing = [...importedPackages(source)].filter(
			(name) => !DEV_PACKAGES.has(name) && !installed.has(name),
		);

		expect(missing).toEqual([]);
	});
});
