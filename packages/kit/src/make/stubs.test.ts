/**
 * The built-in stubs' module JSDoc: every TypeScript stub points at the sdxc.dev pages a
 * reader needs to fill the generated file in, and those links sit before `{{header}}` so the
 * author tags still close the block.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { builtinStubsDir } from "./stubs.js";

const STUBS_DIR = builtinStubsDir(fileURLToPath(new URL("../..", import.meta.url)));

const DOC_LINK = /^ \* @see \{@link https:\/\/sdxc\.dev\/(docs|api)\/[a-z0-9/-]+\}$/;

describe("built-in stubs", async () => {
	let names = (await readdir(STUBS_DIR)).filter(
		(name) =>
			name.endsWith(".stub") && !name.endsWith("migration.stub") && !name.endsWith(".spec.stub"),
	);

	test.each(names)("%s links the sdxc.dev docs before {{header}}", async (name) => {
		let text = await readFile(join(STUBS_DIR, name), "utf8");
		let header = text.slice(0, text.indexOf("*/"));
		let links = header.split("\n").filter((line) => line.includes("@see"));
		expect(links.length).toBeGreaterThan(0);
		for (let line of links) expect(line.replace("{{header}}", "")).toMatch(DOC_LINK);
		expect(links.at(-1)).toMatch(/\{\{header\}\}$/);
	});

	let specs = (await readdir(STUBS_DIR)).filter((name) => name.endsWith(".spec.stub"));

	test.each(specs)("%s points at the sdxc.dev testing docs", async (name) => {
		let text = await readFile(join(STUBS_DIR, name), "utf8");
		expect(text).toMatch(/# @see https:\/\/sdxc\.dev\/docs\/operations-and-testing\/testing/);
	});
});
