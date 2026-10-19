/**
 * Repo-wide guard that package source reads `import.meta.env` through optional chaining. A
 * consumer's Vitest run leaves installed packages untransformed, where `import.meta.env` is
 * undefined, so a bare `import.meta.env.DEV` throws on import for everyone testing with the package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

/** Repo root, resolved from this file so the scan targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/** A property read on `import.meta.env` with no `?.` before it. */
const UNGUARDED_ENV_READ = /import\.meta\.env(\.|\[)/;

/**
 * Lines of `source` that read `import.meta.env` unguarded, skipping comment lines where
 * documentation quotes the expression.
 *
 * @param source A module's text.
 * @returns The 1-based line numbers of every unguarded read.
 */
function findUnguardedEnvReads(source: string): number[] {
	let lines: number[] = [];
	for (let [index, line] of source.split("\n").entries()) {
		let trimmed = line.trimStart();
		if (trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("//")) continue;
		if (UNGUARDED_ENV_READ.test(line)) lines.push(index + 1);
	}
	return lines;
}

/** Every shipped TypeScript source under a package's `src/`; tests run inside Vite, which defines the object. */
function packageSourceFiles(): string[] {
	return globSync("packages/*/src/**/*.{ts,tsx}", { cwd: ROOT }).filter(
		(path) => !path.includes("/node_modules/") && !/\.test\.tsx?$/.test(path),
	);
}

describe("packages read import.meta.env through optional chaining", () => {
	test("the scanner reports bare reads and accepts guarded ones and comments", () => {
		let source = [
			"if (import.meta.env.DEV) warn();",
			"if (import.meta.env?.DEV) warn();",
			' * `import.meta.env.DEV` in a comment"',
			'let mode = import.meta.env["MODE"];',
		].join("\n");

		expect(findUnguardedEnvReads(source)).toEqual([1, 4]);
	});

	test("every package source file passes", () => {
		let offenders: string[] = [];
		for (let file of packageSourceFiles()) {
			for (let line of findUnguardedEnvReads(readFileSync(join(ROOT, file), "utf8"))) {
				offenders.push(`${file}:${line}`);
			}
		}

		expect(offenders, "bare import.meta.env reads").toEqual([]);
	});
});
