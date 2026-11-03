/**
 * Guards the repo's patch to Vitest's browser tester: two testers sharing an iframe id must ignore
 * each other's `ready` and `response:*` messages, or their replies echo until the heap is gone.
 * Fails when a Vitest upgrade installs a tester the patch no longer reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

/** Repo root, resolved from this file so the lookup targets the same install from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/**
 * The tester bundle every browser project loads: the `@vitest/browser` installed beside the
 * Playwright provider the root config imports, which is the copy the patch must reach.
 */
function testerSource(): string {
	let provider = realpathSync(join(ROOT, "node_modules/@vitest/browser-playwright"));
	let client = join(provider, "../browser/dist/client/__vitest_browser__");
	let [tester] = globSync("tester-*.js", { cwd: client });
	expect(tester, `no tester bundle in ${client}`).toBeDefined();
	return readFileSync(join(client, tester!), "utf8");
}

describe("Vitest's browser tester", () => {
	test("returns on another tester's ready and response:* messages before reading the event", () => {
		let source = testerSource();
		let guard = source.indexOf('if (data.event === "ready" || data.event.startsWith("response:"))');
		let dispatch = source.indexOf("switch (data.event)");
		expect(guard, "the response guard from patches/ is missing").toBeGreaterThan(-1);
		expect(guard).toBeLessThan(dispatch);
	});
});
