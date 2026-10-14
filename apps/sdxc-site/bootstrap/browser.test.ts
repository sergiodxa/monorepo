/**
 * Holds every island to the identity the build can resolve: `clientEntry(import.meta.url, …)`
 * is rewritten into a `file:` id the renderer maps to the island's own chunk, while a written
 * URL names a source path that exists only in development and fails to hydrate once built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

/** The app's root, which every path this test reports is relative to. */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every `clientEntry(` call and the first argument it passes, across the app's components. */
function clientEntryCalls(): { file: string; id: string }[] {
	return globSync("{app,resources}/**/*.tsx", { cwd: APP_DIR }).flatMap((file) =>
		[...readFileSync(join(APP_DIR, file), "utf8").matchAll(/clientEntry\(\s*([^,]+),/g)].map(
			(match) => ({ file, id: match[1] ?? "" }),
		),
	);
}

test("every island is identified by its own module URL", () => {
	let calls = clientEntryCalls();

	expect(calls.length).toBeGreaterThan(0);
	expect(calls.filter((call) => call.id !== "import.meta.url")).toEqual([]);
});
