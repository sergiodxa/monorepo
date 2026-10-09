/**
 * Guards the `@sdxc/web-push/browser` entry against reaching a Node builtin. A dev server
 * serves each module of a client entry unbundled, so one `node:` import anywhere in the
 * graph breaks hydration there even when a production build tree-shakes it away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { describe, expect, test } from "vitest";

/** The workspace's `packages/` directory, where every `@sdxc/*` import resolves. */
const PACKAGES = resolve(import.meta.dirname, "../..");

/** Runtime imports and re-exports; `import type` statements are erased before a browser loads anything. */
const RUNTIME_IMPORT =
	/^(?:import|export)(?!\s+type\b)[^;]*?\sfrom\s+"([^"]+)"|^import\s+"([^"]+)"/gm;

/**
 * Resolves an `@sdxc/<name>[/<subpath>]` specifier to the source file its package's
 * `exports` map names, the file a dev server serves for it.
 */
async function resolveWorkspace(specifier: string): Promise<string> {
	let [, name = "", ...rest] = specifier.split("/");
	let subpath = rest.length === 0 ? "." : `./${rest.join("/")}`;
	let manifest = JSON.parse(await readFile(join(PACKAGES, name, "package.json"), "utf8")) as {
		exports: Record<string, string>;
	};
	let target = manifest.exports[subpath];
	if (target === undefined) throw new Error(`${specifier} is not exported`);
	return join(PACKAGES, name, target);
}

/**
 * Every module reachable from `entry` through runtime imports, following relative and
 * `@sdxc/*` specifiers, with each `node:` import reported as `module -> specifier`.
 */
async function walkGraph(entry: string): Promise<{ visited: string[]; builtins: string[] }> {
	let visited = new Set<string>();
	let builtins: string[] = [];
	let pending = [entry];
	for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
		if (visited.has(path)) continue;
		visited.add(path);
		let text = await readFile(path, "utf8");
		for (let match of text.matchAll(RUNTIME_IMPORT)) {
			let specifier = match[1] ?? match[2] ?? "";
			if (specifier.startsWith("node:"))
				builtins.push(`${path.replace(`${PACKAGES}/`, "")} -> ${specifier}`);
			else if (specifier.startsWith("."))
				pending.push(join(dirname(path), specifier.replace(/\.js$/, ".ts")));
			else if (specifier.startsWith("@sdxc/")) pending.push(await resolveWorkspace(specifier));
		}
	}
	return { visited: [...visited].map((path) => path.replace(`${PACKAGES}/`, "")), builtins };
}

describe("the @sdxc/web-push/browser import graph", () => {
	test("reaches no Node builtin, so an unbundled dev server can load it", async () => {
		let graph = await walkGraph(await resolveWorkspace("@sdxc/web-push/browser"));

		expect(graph.visited).toContain("crypto/src/encoding.ts");
		expect(graph.builtins).toEqual([]);
	});
});
