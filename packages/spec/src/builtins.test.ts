/**
 * Tests for choosing which built-in capabilities a run registers at all. The
 * distinction under test is registration versus permission: a namespace left
 * out is not denied, it does not exist, and a spec naming it fails to resolve
 * rather than being told which flag would allow it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import type { Grants } from "./permissions";

import { BUILTIN_NAMESPACES, createBuiltinPlugins } from "./builtins";
import { runSuite } from "./runner";

const CREATED_DIRS: string[] = [];

afterEach(async () => {
	for (let dir of CREATED_DIRS.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function makeSuiteDir(text: string): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "spec-builtins-"));
	CREATED_DIRS.push(root);
	await writeFile(join(root, "suite.spec"), text, "utf8");
	return root;
}

function noGrants(): Grants {
	return {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
	};
}

describe("createBuiltinPlugins", () => {
	test("with no selection it builds every built-in namespace", () => {
		let namespaces = createBuiltinPlugins().map((plugin) => plugin.namespace);
		expect(namespaces).toEqual([...BUILTIN_NAMESPACES]);
	});

	test("a selection builds exactly those namespaces, in the canonical order", () => {
		let namespaces = createBuiltinPlugins(["jwt", "http", "url"]).map((plugin) => plugin.namespace);
		expect(namespaces).toEqual(["http", "url", "jwt"]);
	});

	test("an empty selection builds nothing", () => {
		expect(createBuiltinPlugins([])).toEqual([]);
	});

	test("a repeated namespace is registered once", () => {
		let namespaces = createBuiltinPlugins(["url", "url"]).map((plugin) => plugin.namespace);
		expect(namespaces).toEqual(["url"]);
	});
});

describe("runSuite with a chosen built-in set", () => {
	test("a namespace left out is unresolvable, not denied", async () => {
		let root = await makeSuiteDir(
			['test "writes a file" {', "\tgiven {", '\t\tfs.write "out.txt" "hi"', "\t}", "}"].join("\n"),
		);
		let run = await runSuite({ root, grants: noGrants(), builtins: ["url"] });
		if (isFailure(run)) throw new Error(`Expected the run to start: ${run.error.message}`);
		let [result] = run.data.results;
		expect(result?.status).toBe("failed");
		expect(result?.error?.code).toBe("unknown-name");
		expect(result?.error?.message).toContain("fs");
	});

	test("a namespace kept in still works", async () => {
		let root = await makeSuiteDir(
			[
				'test "reads a query parameter" {',
				"\twhen {",
				'\t\tlet code = url.query "https://example.com/cb?code=abc" "code"',
				"\t}",
				"\tthen {",
				'\t\texpect code "abc"',
				"\t}",
				"}",
			].join("\n"),
		);
		let run = await runSuite({ root, grants: noGrants(), builtins: ["url"] });
		if (isFailure(run)) throw new Error(`Expected the run to start: ${run.error.message}`);
		expect(run.data.passed).toBe(1);
	});

	test("omitting the option keeps every built-in, as before", async () => {
		let root = await makeSuiteDir(
			[
				"use fs",
				'test "writes a file" {',
				"\tgiven {",
				'\t\twrite "out.txt" "hi"',
				"\t}",
				"\tthen {",
				'\t\texpect file "out.txt" contains "hi"',
				"\t}",
				"}",
			].join("\n"),
		);
		let run = await runSuite({ root, grants: noGrants() });
		if (isFailure(run)) throw new Error(`Expected the run to start: ${run.error.message}`);
		expect(run.data.passed).toBe(1);
	});
});
