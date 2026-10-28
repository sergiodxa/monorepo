/**
 * Guards the `@sdxc/mcp/client` entry's promise to Worker and browser bundles:
 * its runtime import graph never reaches Remix or the server handler modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { describe, expect, test } from "vitest";

/** This package's root, where `exports` names the entry under test. */
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");

/** Runtime imports and re-exports; `import type` statements are erased at emit. */
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

/** Every relative module path visited from `entry`. */
async function visitedModules(entry: string): Promise<string[]> {
	let visited = new Set<string>();
	let pending = [entry];
	for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
		if (visited.has(path)) continue;
		visited.add(path);
		for (let match of (await readFile(path, "utf8")).matchAll(RUNTIME_IMPORT)) {
			let specifier = match[1] ?? match[2] ?? "";
			if (specifier.startsWith("."))
				pending.push(join(dirname(path), specifier.replace(/\.js$/, ".ts")));
		}
	}
	return [...visited].map((path) => path.slice(PACKAGE_ROOT.length + 1)).sort();
}

describe("the @sdxc/mcp/client entry", () => {
	test("reaches only @sdxc/result and @sdxc/uuid/v4 outside this package", async () => {
		let manifest = JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
			exports: Record<string, string>;
		};
		let entry = manifest.exports["./client"];
		if (entry === undefined) throw new Error("@sdxc/mcp/client is not exported");

		expect(await externalSpecifiers(join(PACKAGE_ROOT, entry))).toEqual([
			"@sdxc/result",
			"@sdxc/uuid/v4",
		]);
	});

	test("never visits remix, handler, context, or resources modules", async () => {
		let entry = join(PACKAGE_ROOT, "src/client.ts");
		let modules = await visitedModules(entry);
		expect(modules.some((path) => path.includes("handler"))).toBe(false);
		expect(modules.some((path) => path.includes("context"))).toBe(false);
		expect(modules.some((path) => path.includes("resources"))).toBe(false);
		expect(modules.some((path) => path.includes("tools"))).toBe(false);
		expect(modules.join("\n")).not.toMatch(/remix/);
	});
});
