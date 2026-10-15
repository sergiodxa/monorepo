/**
 * How the copies are imported: the alias from `ui.alias` or the tsconfig `paths` entry that
 * covers `ui.directory`, followed through `extends`, and the extension from module resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { parseConfig } from "../config.js";

import { copySpecifier, inferAlias, namesCopy, readLayout } from "./layout.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project holding `files`, and its configuration with `overrides` applied. */
async function project(files: Record<string, string>, overrides: object = {}) {
	let root = await mkdtemp(join(tmpdir(), "sdxc-ui-layout-"));
	PROJECTS.push(root);
	await writeFile(join(root, "package.json"), "{}");
	for (let [path, content] of Object.entries(files)) await writeFile(join(root, path), content);
	return { root, config: unwrap(parseConfig(overrides, root, null)).config };
}

describe("inferAlias", () => {
	test("takes the deepest wildcard target containing the directory", () => {
		let paths = { "~/*": ["./*"], "#ui/*": ["./resources/components/*"], "@x": ["./x"] };

		expect(inferAlias("/p", "resources/components/ui", { paths, pathsBase: "/p" })).toBe("#ui/ui");
		expect(inferAlias("/p", "app/ui", { paths, pathsBase: "/p" })).toBe("~/app/ui");
		expect(
			inferAlias("/p", "resources/components/ui", {
				paths: { "#c/*": ["./resources/components/ui/*"] },
				pathsBase: "/p",
			}),
		).toBe("#c");
		expect(inferAlias("/p", "ui", { paths: { "~/*": ["./app/*"] }, pathsBase: "/p" })).toBeNull();
	});
});

describe("readLayout", () => {
	test("infers the alias through extends and the extension from nodenext resolution", async () => {
		let { root, config } = await project({
			"tsconfig.base.json": JSON.stringify({
				compilerOptions: { baseUrl: ".", paths: { "~/*": ["./*"] }, module: "NodeNext" },
			}),
			"tsconfig.json": '{\n\t// the app\n\t"extends": "./tsconfig.base.json",\n}\n',
		});

		expect(unwrap(await readLayout(root, config))).toEqual({
			directory: "resources/components/ui",
			alias: "~/resources/components/ui",
			extension: ".js",
		});
	});

	test("keeps a configured alias and imports relatively without a tsconfig", async () => {
		let configured = await project({}, { ui: { directory: "app/ui/", alias: "@/ui/" } });
		let bare = await project({});

		expect(unwrap(await readLayout(configured.root, configured.config))).toEqual({
			directory: "app/ui",
			alias: "@/ui",
			extension: "",
		});
		expect(unwrap(await readLayout(bare.root, bare.config)).alias).toBeNull();
	});
});

describe("copySpecifier and namesCopy", () => {
	test("spell and recognize every way a file imports a copy", () => {
		let layout = { directory: "app/ui", alias: "~/ui", extension: ".js" } as const;

		expect(copySpecifier(layout, "app/routes/home.tsx", "button")).toBe("~/ui/button.js");
		expect(copySpecifier(layout, "app/ui/dialog.tsx", "button")).toBe("./button.js");
		expect(namesCopy(layout, "app/routes/home.tsx", "~/ui/button", "button")).toBe(true);
		expect(namesCopy(layout, "app/routes/home.tsx", "../ui/button.tsx", "button")).toBe(true);
		expect(namesCopy(layout, "app/routes/home.tsx", "./button.js", "button")).toBe(false);
		expect(namesCopy(layout, "app/routes/home.tsx", "~/ui/button-group", "button")).toBe(false);
	});
});
