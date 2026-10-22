/**
 * The entry point's shape: every icon is defined in it, so importing one icon loads the same four
 * modules as importing all of them, which keeps a cold test run or dev server from transforming a
 * file per icon.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vite-plus/test";

import * as icons from "./index.js";

describe("@sdxc/icons", () => {
	test("imports only the factory, the registry, <Icon /> and the name map", async () => {
		let source = await readFile(new URL("index.ts", import.meta.url), "utf8");
		let specifiers = new Set(Array.from(source.matchAll(/from "(\.[^"]+)"/g), ([, path]) => path));

		expect(specifiers).toEqual(
			new Set(["./create-lucide-icon.js", "./icon-names.js", "./icon.js", "./registry.js"]),
		);
	});

	test("exports a component for every icon name", () => {
		let components = Object.keys(icons).filter((name) => /^[A-Z]\w*Icon$/.test(name));

		expect(components).toHaveLength(Object.keys(icons.iconExportNames).length);
		expect(icons.LoaderCircleIcon.name).toBe("LoaderCircleIcon");
	});
});
