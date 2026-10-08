/**
 * Holds the browser entry's module list to the islands the site renders: a `clientEntry()`
 * module the list misses renders on the server and then fails to hydrate, so every island
 * under `resources/` must match one of the patterns `bootstrap/browser.ts` globs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

/** The `bootstrap/` directory, which the entry's glob patterns are relative to. */
const BOOTSTRAP_DIR = dirname(fileURLToPath(import.meta.url));

/** The app's root, which every path this test compares is relative to. */
const APP_DIR = join(BOOTSTRAP_DIR, "..");

/** Every file the entry's `import.meta.glob` patterns match, relative to the app's root. */
function hydratableModules(): Set<string> {
	let source = readFileSync(join(BOOTSTRAP_DIR, "browser.ts"), "utf8");
	let list = source.match(/import\.meta\.glob\(\[([^\]]*)\]/)?.[1] ?? "";
	let patterns = [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");

	return new Set(
		patterns.flatMap((pattern) =>
			globSync(pattern, { cwd: BOOTSTRAP_DIR }).map((file) =>
				relative(APP_DIR, join(BOOTSTRAP_DIR, file)),
			),
		),
	);
}

test("the browser entry can load every island", () => {
	let modules = hydratableModules();
	let islands = globSync("resources/**/*.tsx", { cwd: APP_DIR }).filter((file) =>
		readFileSync(join(APP_DIR, file), "utf8").includes("clientEntry("),
	);

	expect(islands.length).toBeGreaterThan(0);
	expect(islands.filter((file) => !modules.has(file))).toEqual([]);
});
