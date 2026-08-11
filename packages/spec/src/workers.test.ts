/**
 * Tests for the Workers entry point: a suite loaded from strings, run with an
 * explicitly chosen plugin set and no filesystem, plus the guard that keeps the
 * entry point's import graph free of anything a V8-isolate runtime cannot load.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { isFailure } from "@pkg/result";

import type { Grants } from "./permissions";
import type { SuiteResult } from "./workers";

import {
	createHttpPlugin,
	createJwtPlugin,
	createNoFilesystemWorkspace,
	createUrlPlugin,
	loadSources,
	runTests,
} from "./workers";

function noGrants(): Grants {
	return {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
	};
}

/** Run one spec source through the Workers surface, with the safe plugin set. */
async function run(text: string, grants: Grants = noGrants()): Promise<SuiteResult> {
	let loaded = loadSources([{ path: "flow.spec", text }]);
	if (isFailure(loaded)) throw new Error(loaded.error.message);
	let result = await runTests({
		suite: loaded.data,
		plugins: [createHttpPlugin(), createUrlPlugin(), createJwtPlugin()],
		grants,
		createWorkspace: createNoFilesystemWorkspace,
	});
	if (isFailure(result)) throw new Error(`Expected the run to start: ${result.error.message}`);
	return result.data;
}

describe("the Workers entry point", () => {
	test("runs a suite loaded from strings, with no filesystem anywhere", async () => {
		let outcome = await run(
			[
				"use url",
				'test "the authorization code is read from the redirect URL" {',
				"\twhen {",
				'\t\tlet code = url.query "https://app.example.com/cb?code=abc123" "code"',
				"\t}",
				"\tthen {",
				'\t\texpect code "abc123"',
				"\t}",
				"}",
			].join("\n"),
		);
		expect(outcome.passed).toBe(1);
		expect(outcome.failed).toBe(0);
	});

	test("a spec reaching for the network is denied, with the flag that would allow it", async () => {
		let outcome = await run(
			[
				'test "calls an endpoint" {',
				"\twhen {",
				'\t\tlet response = http.get "https://app.example.com/health"',
				"\t}",
				"}",
			].join("\n"),
		);
		expect(outcome.failed).toBe(1);
		expect(outcome.results[0]?.error?.code).toBe("permission-denied");
	});

	test("a spec reaching for a file finds no such namespace", async () => {
		let outcome = await run(
			['test "writes a file" {', "\tgiven {", '\t\tfs.write "out.txt" "hi"', "\t}", "}"].join("\n"),
		);
		expect(outcome.failed).toBe(1);
		expect(outcome.results[0]?.error?.code).toBe("unknown-name");
	});

	test("results stay in source order across a concurrent run", async () => {
		let outcome = await run(
			[
				"use url",
				'test "first" {',
				"\tthen {",
				'\t\texpect url.path "https://example.com/a" "/a"',
				"\t}",
				"}",
				'test "second" {',
				"\tthen {",
				'\t\texpect url.path "https://example.com/b" "/b"',
				"\t}",
				"}",
			].join("\n"),
		);
		expect(outcome.results.map((result) => result.title)).toEqual(["first", "second"]);
	});
});

describe("createNoFilesystemWorkspace", () => {
	test("refuses every path, saying there is no filesystem rather than pretending", async () => {
		let created = await createNoFilesystemWorkspace();
		if (isFailure(created)) throw new Error(created.error.message);
		let workspace = created.data;
		for (let path of ["out.txt", "/etc/passwd", "../escape"]) {
			let resolved = workspace.resolve(path);
			if (!isFailure(resolved)) throw new Error(`Expected ${path} to be refused.`);
			expect(resolved.error.code).toBe("tool-error");
			expect(resolved.error.message).toContain("no filesystem");
		}
		// Cleanup is a no-op rather than an error: the runner always calls it.
		expect(await workspace.cleanup()).toBeUndefined();
	});
});

describe("the Workers entry point's import graph", () => {
	test("reaches nothing that only a Bun or Node process provides", async () => {
		let visited = new Set<string>();
		let offences: string[] = [];
		await walk(resolve(import.meta.dir, "workers.ts"));

		/**
		 * Follow every relative import from a module, recording any dependency on
		 * `bun`/`bun:*` specifiers or the `Bun` global — the two things that make a
		 * module unloadable in a V8-isolate runtime. `node:*` is deliberately
		 * allowed: those resolve under the `nodejs_compat` flag, and the paths that
		 * would actually call into them are gated behind grants a hosted run never
		 * makes (see the `permissions` row of ADR-027's portability table).
		 */
		async function walk(path: string): Promise<void> {
			if (visited.has(path)) return;
			visited.add(path);
			let text = await readFile(path, "utf8");
			let relativeTo = dirname(path);
			for (let match of text.matchAll(/from\s+"([^"]+)"/g)) {
				let specifier = match[1];
				if (specifier === undefined) continue;
				if (specifier === "bun" || specifier.startsWith("bun:")) {
					offences.push(`${path} imports "${specifier}"`);
					continue;
				}
				if (!specifier.startsWith(".")) continue;
				await walk(join(relativeTo, `${specifier}.ts`));
			}
			if (/\bBun\./.test(text)) offences.push(`${path} uses the Bun global`);
		}

		expect(offences).toEqual([]);
		// A guard that silently stopped walking would also pass, so assert it
		// actually reached the core it is meant to be vouching for.
		expect([...visited].map((path) => path.replace(`${import.meta.dir}/`, ""))).toContain(
			"executor.ts",
		);
	});
});
