/**
 * Guards the `@sdxc/crypto/encoding` entry's promise to browser bundles: its import graph
 * stays on Web APIs, so a dev server loading it module by module never requests the
 * `node:crypto` import that password hashing needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { describe, expect, test } from "vitest";

/** This package's root, where `exports` names the entry under test. */
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");

/** Runtime imports and re-exports; `import type` statements are erased before a browser loads anything. */
const RUNTIME_IMPORT =
	/^(?:import|export)(?!\s+type\b)[^;]*?\sfrom\s+"([^"]+)"|^import\s+"([^"]+)"/gm;

/** Every bare or `node:` specifier reachable from `entry` through relative runtime imports. */
async function externalSpecifiers(entry: string): Promise<string[]> {
	let visited = new Set<string>();
	let external = new Set<string>();
	let pending = [entry];
	for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
		if (visited.has(path)) continue;
		visited.add(path);
		for (let match of (await readFile(path, "utf8")).matchAll(RUNTIME_IMPORT)) {
			let specifier = match[1] ?? match[2] ?? "";
			if (specifier.startsWith("."))
				pending.push(join(dirname(path), specifier.replace(/\.js$/, ".ts")));
			else external.add(specifier);
		}
	}
	return [...external].sort();
}

describe("the @sdxc/crypto/encoding entry", () => {
	test("reaches only @sdxc/result outside this package", async () => {
		let manifest = JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
			exports: Record<string, string>;
		};
		let entry = manifest.exports["./encoding"];
		if (entry === undefined) throw new Error("@sdxc/crypto/encoding is not exported");

		expect(await externalSpecifiers(join(PACKAGE_ROOT, entry))).toEqual(["@sdxc/result"]);
	});
});
