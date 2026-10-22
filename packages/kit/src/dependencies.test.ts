/**
 * Which `@sdxc/*` packages generated code needs listed: every imported package, plus the
 * optional peers an imported subpath loads at runtime, checked against the factory stubs with
 * their placeholders filled in so they parse as TypeScript.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { importedPackages } from "./dependencies.js";

/** The kit's own `stubs/` folder, resolved from this file. */
const STUBS = join(import.meta.dirname, "..", "stubs");

describe(importedPackages.name, () => {
	test("lists each package once, by its name, whatever subpath it is imported from", () => {
		let files = [
			{
				path: "a.ts",
				content: [
					'import { a } from "@sdxc/result";',
					'import { b } from "@sdxc/ui/button";',
					'let c = await import("@sdxc/ui/form");',
					'import { d } from "remix/component";',
				].join("\n"),
			},
		];

		expect(importedPackages(files)).toEqual(["@sdxc/result", "@sdxc/ui"]);
	});

	test("lists @sdxc/spec when any pairing .spec file is among the written files", () => {
		expect(
			importedPackages([
				{ path: "spec/about.spec", content: "use browser\n" },
				{ path: "app/http/controllers/about.tsx", content: "export default {};\n" },
			]),
		).toEqual(["@sdxc/spec"]);
	});

	test.each(["factory.stub", "scaffold.factory.stub", "scaffold.test-database.stub"])(
		"adds @sdxc/sample for %s, whose @sdxc/data-model/testing import loads it",
		async (stub) => {
			let content = (await readFile(join(STUBS, stub), "utf8")).replaceAll(/\{\{\w+\}\}/g, "post");

			expect(importedPackages([{ path: "factory.ts", content }])).toEqual(
				expect.arrayContaining(["@sdxc/data-model", "@sdxc/sample"]),
			);
		},
	);
});
