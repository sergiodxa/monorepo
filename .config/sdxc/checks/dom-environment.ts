/**
 * Fails on a test that asks Vitest for a simulated DOM (`@vitest-environment happy-dom` or
 * `jsdom`). A test that needs a DOM is a `*.browser.test.ts(x)` file running in real Chromium
 * through Vitest Browser Mode, so a passing test proves the component works in a browser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineCheck } from "@sdxc/kit/doctor";

/** Matches the docblock directive selecting a simulated DOM environment. */
const SIMULATED_DOM = /@vitest-environment\s+(?:happy-dom|jsdom)\b/;

/** A Vitest test file, by name. */
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/** Folders scanned at the monorepo root. */
const FOLDERS = ["apps", "packages", "cli", "scripts", "test"] as const;

/** Whether `path` is generated or installed code that no one in the repo authors. */
function generated(path: string): boolean {
	return path.includes("/node_modules/") || path.includes("/dist/");
}

export default defineCheck({
	name: "dom-environment",
	async run(ctx) {
		let findings: string[] = [];
		for (let folder of FOLDERS) {
			for (let file of await ctx.files(folder)) {
				if (!TEST_FILE.test(file) || generated(file)) continue;
				let text = await ctx.readFile(file);
				if (text === null) continue;
				let lines = text.split("\n");
				for (let index = 0; index < lines.length; index++) {
					let line = lines[index]!;
					if (!SIMULATED_DOM.test(line)) continue;
					findings.push(`${file}:${index + 1}: ${line.trim()}`);
				}
			}
		}
		if (findings.length === 0) {
			return { status: "pass", message: "Every DOM test runs in Vitest Browser Mode" };
		}
		return {
			status: "fail",
			message:
				findings.length === 1
					? "Found 1 test on a simulated DOM"
					: `Found ${findings.length} tests on a simulated DOM`,
			findings,
			fix: "Drop the @vitest-environment directive and rename the file to *.browser.test.ts(x)",
		};
	},
});
