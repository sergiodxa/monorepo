/**
 * Tests for the suite runner: real suite directories on disk, the real
 * built-in plugins, per-test workspaces, and grants flowing into the central
 * permission gate — the whole run path short of the CLI.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { isFailure } from "@pkg/result";

import type { SuiteResult } from "./diagnostics";
import type { Grants } from "./permissions";

import { PermissionDeniedError } from "./errors";
import { runSuite } from "./runner";

const CREATED_DIRS: string[] = [];

afterEach(async () => {
	for (let dir of CREATED_DIRS.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function makeSuiteDir(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "spec-runner-"));
	CREATED_DIRS.push(root);
	for (let [relativePath, text] of Object.entries(files)) {
		let path = join(root, relativePath);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, text, "utf8");
	}
	return root;
}

function deniedGrants(): Grants {
	return {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
	};
}

async function runOk(root: string, grants: Grants = deniedGrants()): Promise<SuiteResult> {
	let result = await runSuite({ root, grants });
	if (isFailure(result)) throw new Error(`Expected the run to start: ${result.error.message}`);
	return result.data;
}

describe("runSuite", () => {
	test("a passing suite reports every test as passed", async () => {
		let root = await makeSuiteDir({
			"files.spec": `use fs

test "written files are observable" {
	when {
		write "note.txt" "made it"
	}
	then {
		expect file "note.txt" exists
		expect file "note.txt" contains "made it"
	}
}
`,
			"values.spec": `test "bindings hold their values" {
	given {
		let greeting = "hello"
	}
	then {
		expect greeting "hello"
	}
}
`,
		});

		let suite = await runOk(root);

		expect(suite.passed).toBe(2);
		expect(suite.failed).toBe(0);
		expect(suite.results.map((result) => result.status)).toEqual(["passed", "passed"]);
	});

	test("a failing expectation fails its test and carries the structured error", async () => {
		let root = await makeSuiteDir({
			"failing.spec": `test "this one fails" {
	then {
		expect 1 2
	}
}
`,
		});

		let suite = await runOk(root);

		expect(suite.passed).toBe(0);
		expect(suite.failed).toBe(1);
		let result = suite.results[0];
		expect(result?.title).toBe("this one fails");
		expect(result?.status).toBe("failed");
		expect(result?.error?.code).toBe("expectation-failed");
	});

	test("a command body resolves bare names against its defining file's imports", async () => {
		let root = await makeSuiteDir({
			"commands/marker.spec": `use fs

command touch_marker {
	write "marker.txt" "made"
}
`,
			"run.spec": `test "a helper defined under use fs works from an import-free file" {
	when {
		touch_marker
	}
	then {
		expect fs.file "marker.txt" contains "made"
	}
}
`,
		});

		let suite = await runOk(root);

		expect(suite.failed).toBe(0);
		expect(suite.passed).toBe(1);
	});

	test("the caller's imports never leak into a command body", async () => {
		let root = await makeSuiteDir({
			"commands/naked.spec": `command naked_write {
	write "marker.txt" "x"
}
`,
			"run.spec": `use fs

test "a helper defined without use fs cannot use the caller's import" {
	when {
		naked_write
	}
}
`,
		});

		let suite = await runOk(root);

		expect(suite.failed).toBe(1);
		let result = suite.results[0];
		expect(result?.error?.code).toBe("unknown-name");
		expect(result?.error?.message).toContain('"write"');
	});

	test("a denied run permission is refused before any process spawns", async () => {
		let root = await makeSuiteDir({
			"denied.spec": `use cli

test "running a program needs --allow-run" {
	when {
		let result = run "definitely-not-a-real-binary" "--version"
	}
}
`,
		});

		let suite = await runOk(root, deniedGrants());

		expect(suite.failed).toBe(1);
		let error = suite.results[0]?.error;
		// A spawn attempt would surface as a tool-error (ENOENT for this
		// binary); the gate must refuse with a denial before that can happen.
		expect(error).toBeInstanceOf(PermissionDeniedError);
		if (!(error instanceof PermissionDeniedError)) throw new Error("narrowing");
		expect(error.permission).toBe("run");
		expect(error.remedy).toContain("--allow-run");
	});

	test("a load failure aborts the whole run before any test result exists", async () => {
		let root = await makeSuiteDir({
			"broken.spec": `test "never closed" {
	then {
`,
		});

		let result = await runSuite({ root, grants: deniedGrants() });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.code).toBe("parse-error");
	});
});
