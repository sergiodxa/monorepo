/**
 * Holds the document subpaths to their dependency budget: `@sdxc/result`,
 * `@sdxc/json-pointer`, `@sdxc/link-header`, `@sdxc/openpgp`, `@remix-run/data-schema`
 * and `@standard-schema/spec` only, so a consumer without the `remix` umbrella or
 * `@sdxc/http` can parse through them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { findModuleReferences } from "@sdxc/codemod";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

/** The packages a document subpath may import. */
const ALLOWED = new Set([
	"@sdxc/result",
	"@sdxc/json-pointer",
	"@sdxc/link-header",
	"@sdxc/openpgp",
	"@remix-run/data-schema",
	"@standard-schema/spec",
]);

/** The modules that may reach the optional peers. */
const PEER_MODULES = new Set(["response.ts", "middleware.ts"]);

/**
 * The bare package a specifier names, or `null` for a relative import.
 *
 * @param specifier - An import specifier.
 */
function packageOf(specifier: string): string | null {
	if (specifier.startsWith(".")) return null;
	let parts = specifier.split("/");
	return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? null);
}

/**
 * Every source module, excluding tests, relative to this directory.
 *
 * @param directory - The directory to walk.
 */
function sourceModules(directory: string): string[] {
	return readdirSync(directory, { recursive: true, encoding: "utf8" }).filter(
		(file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
	);
}

describe("document subpaths", () => {
	let root = import.meta.dirname;

	test.each(sourceModules(root).filter((file) => !PEER_MODULES.has(file)))(
		"%s imports only the allowed packages",
		(file) => {
			let references = unwrap(findModuleReferences(file, readFileSync(join(root, file), "utf8")));
			let packages = references
				.filter((reference) => reference.kind === "import" || reference.kind === "export")
				.map((reference) => packageOf(reference.specifier))
				.filter((name) => name !== null);
			expect(packages.filter((name) => !ALLOWED.has(name))).toEqual([]);
		},
	);
});
