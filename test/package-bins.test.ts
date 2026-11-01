/**
 * Repo-wide guard that every package command line follows one convention: an `sdxc-<directory>`
 * bin at `src/cli.ts` with a Node shebang, a contract, tests and `@sdxc/cli` underneath, so
 * `bunx @sdxc/<name>` and `npx @sdxc/<name>` behave alike for every package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import type { PackageBinFacts } from "./package-bins.js";

import { packageBinProblems } from "./package-bins.js";

/** Repo root, resolved from this file so the scan targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/** A conforming command line for `packages/<dir>`, with any fact overridden. */
function facts(dir: string, overrides: Partial<PackageBinFacts> = {}): PackageBinFacts {
	return {
		dir,
		bin: { [`sdxc-${dir}`]: "./src/cli.ts" },
		cliFirstLine: "#!/usr/bin/env node",
		hasContract: true,
		hasCliTest: true,
		dependsOnCli: true,
		...overrides,
	};
}

/** The facts for every `packages/<dir>` whose manifest declares a `bin`, read from disk. */
function repoFacts(): PackageBinFacts[] {
	let packagesDir = join(ROOT, "packages");
	let found: PackageBinFacts[] = [];
	for (let entry of readdirSync(packagesDir, { withFileTypes: true })) {
		let dir = join(packagesDir, entry.name);
		if (!entry.isDirectory() || !existsSync(join(dir, "package.json"))) continue;
		let manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
			bin?: string | Record<string, string>;
			dependencies?: Record<string, string>;
		};
		if (manifest.bin === undefined) continue;
		let cliPath = join(dir, "src/cli.ts");
		found.push({
			dir: entry.name,
			bin: manifest.bin,
			cliFirstLine: existsSync(cliPath) ? readFileSync(cliPath, "utf8").split("\n")[0] : null,
			hasContract: existsSync(join(dir, "src/cli-contract.ts")),
			hasCliTest: existsSync(join(dir, "src/cli.test.ts")),
			dependsOnCli: manifest.dependencies?.["@sdxc/cli"] !== undefined,
		});
	}
	return found;
}

describe("package command lines follow one convention", () => {
	describe("the checker itself", () => {
		test("accepts a conforming command line", () => {
			expect(packageBinProblems(facts("jwt"))).toEqual([]);
		});

		test("names every departure", () => {
			let problems = packageBinProblems(
				facts("jwt", {
					bin: { jwt: "./src/cli.ts" },
					cliFirstLine: "#!/usr/bin/env bun",
					hasContract: false,
					hasCliTest: false,
					dependsOnCli: false,
				}),
			);
			expect(problems).toEqual([
				'jwt: bin must be {"sdxc-jwt":"./src/cli.ts"}',
				"jwt: src/cli.ts must start with #!/usr/bin/env node",
				"jwt: src/cli-contract.ts is missing",
				"jwt: src/cli.test.ts is missing",
				"jwt: dependencies must include @sdxc/cli",
			]);
		});

		test("reports a missing entry point", () => {
			expect(packageBinProblems(facts("qr", { cliFirstLine: null }))).toEqual([
				"qr: src/cli.ts is missing",
			]);
		});

		test("holds a bin published before the convention to its released entry", () => {
			expect(packageBinProblems(facts("spec", { bin: { spec: "./src/cli.ts" } }))).toEqual([]);
			expect(packageBinProblems(facts("spec", { bin: { "sdxc-spec": "./src/cli.ts" } }))).toEqual([
				'spec: bin must stay {"spec":"./src/cli.ts"}',
			]);
		});
	});

	test("every package bin in the repo conforms", () => {
		expect(repoFacts().flatMap(packageBinProblems)).toEqual([]);
	});
});
