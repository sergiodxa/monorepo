/**
 * Holds the package's layout to its rules: the root folder ships general components, each
 * namespace is a folder exported as a barrel and per module, namespaces build on the root
 * and never on each other, and no module takes a name a namespace or helper subpath uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

/** Absolute path to `src/`. */
const SRC = dirname(fileURLToPath(import.meta.url));

/** The namespaces, each a folder under `src/` and a subpath of the package. */
const NAMESPACES = ["landing", "docs", "chat", "color", "app"];

/** The helper subpaths every kit shares. */
const HELPER_SUBPATHS = ["mixins", "behaviors", "styles", "animations", "utils"];

/** The package's export map. */
const EXPORTS = (
	JSON.parse(readFileSync(join(SRC, "..", "package.json"), "utf8")) as {
		exports: Record<string, string>;
	}
).exports;

/** Every relative specifier a module imports, resolved to the folder under `src/` it lands in. */
function importedFolders(file: string): string[] {
	let source = readFileSync(file, "utf8");
	let folders: string[] = [];
	for (let match of source.matchAll(/(?:from|import)\s*\(?\s*"(\.{1,2}\/[^"]+)"/g)) {
		let target = relative(SRC, resolve(dirname(file), match[1] ?? ""));
		folders.push(target.split("/")[0] ?? "");
	}
	return folders;
}

/** The non-test modules under one folder of `src/`, at any depth. */
function modulesIn(folder: string): string[] {
	return globSync("**/*.{ts,tsx}", { cwd: join(SRC, folder) })
		.filter((file) => !/\.test\.tsx?$/.test(file))
		.map((file) => join(SRC, folder, file));
}

describe("@sdxc/ui namespaces", () => {
	test.each(NAMESPACES)("%s is exported as a barrel and per module", (namespace) => {
		expect(EXPORTS[`./${namespace}`]).toBe(`./src/${namespace}/index.ts`);
		expect(EXPORTS[`./${namespace}/*`]).toBe(`./src/${namespace}/*.tsx`);
	});

	test("no root module takes a name a namespace or helper subpath answers to", () => {
		let names = globSync("*.tsx", { cwd: join(SRC, "components") }).map((file) =>
			file.replace(/\.tsx$/, ""),
		);
		expect(names.filter((name) => [...NAMESPACES, ...HELPER_SUBPATHS].includes(name))).toEqual([]);
	});

	test("root components import no namespace", () => {
		let offenders = modulesIn("components").filter((file) =>
			importedFolders(file).some((folder) => NAMESPACES.includes(folder)),
		);
		expect(offenders.map((file) => relative(SRC, file))).toEqual([]);
	});

	test.each(NAMESPACES)("%s imports no other namespace", (namespace) => {
		let offenders = modulesIn(namespace).filter((file) =>
			importedFolders(file).some((folder) => folder !== namespace && NAMESPACES.includes(folder)),
		);
		expect(offenders.map((file) => relative(SRC, file))).toEqual([]);
	});

	test("shared helpers import no namespace", () => {
		let offenders = HELPER_SUBPATHS.flatMap(modulesIn).filter((file) =>
			importedFolders(file).some((folder) => NAMESPACES.includes(folder)),
		);
		expect(offenders.map((file) => relative(SRC, file))).toEqual([]);
	});
});
