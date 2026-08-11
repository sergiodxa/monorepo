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
import { dirname, join, resolve } from "node:path";

import { failure, isFailure, success } from "@pkg/result";

import type { SuiteResult } from "./diagnostics";
import type { Grants } from "./permissions";
import type { Plugin } from "./plugin";

import { PermissionDeniedError, ToolError } from "./errors";
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

	test("a failure inside a cross-file command carries the defining file", async () => {
		let root = await makeSuiteDir({
			"commands/helper.spec": `command broken {
	let x = missing_binding
}
`,
			"main.spec": `test "calls broken" {
	when {
		broken
	}
}
`,
		});

		let suite = await runOk(root);

		expect(suite.failed).toBe(1);
		let result = suite.results[0];
		expect(result?.file).toBe(join(root, "main.spec"));
		expect(result?.error?.code).toBe("unknown-name");
		// The failing statement lives in the helper file; its span only makes
		// sense against that file's text.
		expect(result?.error?.file).toBe(join(root, "commands/helper.spec"));
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

/**
 * A test plugin whose single tool, `probe.wait`, sleeps for a given number of
 * milliseconds while tracking how many calls are in flight at once. The
 * concurrency tests use it to observe whether the runner actually overlaps
 * tests: `maxActive` climbs above 1 only if two waits ran simultaneously, and
 * the recorded wall-clock intervals expose the real overlap.
 */
function createProbePlugin(): {
	plugin: Plugin;
	maxActive: () => number;
	intervals: () => { start: number; end: number }[];
} {
	let active = 0;
	let peak = 0;
	let spans: { start: number; end: number }[] = [];
	let plugin: Plugin = {
		namespace: "probe",
		describe() {
			return [
				{
					name: "wait",
					summary: "Sleep for N milliseconds, tracking concurrent calls.",
					kind: "action",
					params: [
						{ name: "ms", kind: "value", required: true, summary: "Milliseconds to sleep." },
					],
				},
			];
		},
		async call(tool, args) {
			if (tool !== "wait") return failure(new ToolError(`probe has no tool "${tool}".`));
			let first = args[0];
			let ms =
				first !== undefined && first.kind === "value" && typeof first.value === "number"
					? first.value
					: 0;
			active += 1;
			if (active > peak) peak = active;
			let start = performance.now();
			await Bun.sleep(ms);
			active -= 1;
			spans.push({ start, end: performance.now() });
			return success(null);
		},
	};
	return { plugin, maxActive: () => peak, intervals: () => spans };
}

/** The denied-everything grant set the concurrency tests run under. */
function noGrants(): Grants {
	return {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
	};
}

describe("runSuite concurrency", () => {
	test("tests overlap in time when concurrency is above one", async () => {
		let root = await makeSuiteDir({
			"waits.spec": `use probe

test "first waiter" {
	when { wait 120 }
	then { expect 1 1 }
}

test "second waiter" {
	when { wait 120 }
	then { expect 1 1 }
}

test "third waiter" {
	when { wait 120 }
	then { expect 1 1 }
}
`,
		});
		let probe = createProbePlugin();

		let run = await runSuite({ root, grants: noGrants(), plugins: [probe.plugin], concurrency: 3 });
		if (isFailure(run)) throw new Error(run.error.message);

		expect(run.data.passed).toBe(3);
		// Genuine overlap: at least two waits were in flight simultaneously. With
		// three slots and equal sleeps every worker enters before any exits, so
		// the last start precedes the first end — all three intervals overlap.
		expect(probe.maxActive()).toBeGreaterThanOrEqual(2);
		let spans = probe.intervals();
		let latestStart = Math.max(...spans.map((span) => span.start));
		let earliestEnd = Math.min(...spans.map((span) => span.end));
		expect(latestStart).toBeLessThan(earliestEnd);
	});

	test("tests never overlap at the default concurrency of one", async () => {
		let root = await makeSuiteDir({
			"waits.spec": `use probe

test "first waiter" {
	when { wait 40 }
	then { expect 1 1 }
}

test "second waiter" {
	when { wait 40 }
	then { expect 1 1 }
}
`,
		});
		let probe = createProbePlugin();

		// No concurrency option at all: the default is 1, i.e. strictly sequential.
		let run = await runSuite({ root, grants: noGrants(), plugins: [probe.plugin] });
		if (isFailure(run)) throw new Error(run.error.message);

		expect(run.data.passed).toBe(2);
		// Only ever one wait in flight, so each interval ends before the next begins.
		expect(probe.maxActive()).toBe(1);
		let spans = probe.intervals();
		expect(spans[0]?.end).toBeLessThanOrEqual(spans[1]?.start ?? 0);
	});

	test("the reported wall-clock stays below the summed per-test durations under overlap", async () => {
		let root = await makeSuiteDir({
			"waits.spec": `use probe

test "first waiter" {
	when { wait 120 }
	then { expect 1 1 }
}

test "second waiter" {
	when { wait 120 }
	then { expect 1 1 }
}

test "third waiter" {
	when { wait 120 }
	then { expect 1 1 }
}
`,
		});
		let probe = createProbePlugin();

		let run = await runSuite({ root, grants: noGrants(), plugins: [probe.plugin], concurrency: 3 });
		if (isFailure(run)) throw new Error(run.error.message);

		expect(run.data.passed).toBe(3);
		// Three 120ms waits overlap across three slots, so the run finishes in about
		// one wait, yet each test still measures ~120ms of its own. The summary must
		// report the run's wall-clock, which is strictly below the sum of durations —
		// exactly the figure that would balloon if the summary summed them instead.
		let summed = run.data.results.reduce((total, result) => total + result.durationMs, 0);
		expect(run.data.wallMs).toBeLessThan(summed);
	});

	test("the reported wall-clock spans the whole sequential run at concurrency one", async () => {
		let root = await makeSuiteDir({
			"waits.spec": `use probe

test "first waiter" {
	when { wait 40 }
	then { expect 1 1 }
}

test "second waiter" {
	when { wait 40 }
	then { expect 1 1 }
}
`,
		});
		let probe = createProbePlugin();

		let run = await runSuite({ root, grants: noGrants(), plugins: [probe.plugin], concurrency: 1 });
		if (isFailure(run)) throw new Error(run.error.message);

		expect(run.data.passed).toBe(2);
		// No overlap: the wall-clock spans both waits end to end, so it is at least
		// their summed durations (plus each test's workspace setup and teardown) —
		// never the deflated figure a single-test measurement would give. Wall-clock
		// and the sum coincide here, which is why reporting wall-clock stays correct
		// at the default concurrency too.
		let summed = run.data.results.reduce((total, result) => total + result.durationMs, 0);
		expect(run.data.wallMs).toBeGreaterThanOrEqual(summed);
	});

	test("output is byte-for-byte source-ordered at concurrency 1 and 8", async () => {
		// Descending waits across two files: under concurrency the tests complete
		// in the reverse of source order (shortest wait finishes first, and the
		// no-wait failing test finishes first of all), so a source-ordered result
		// array can only come from the runner reordering by source position.
		let files = {
			"a.spec": `use probe

test "alpha one" {
	when { wait 80 }
	then { expect 1 1 }
}

test "alpha two" {
	when { wait 60 }
	then { expect 1 1 }
}
`,
			"b.spec": `use probe

test "beta one" {
	when { wait 40 }
	then { expect 1 1 }
}

test "beta two" {
	when { wait 20 }
	then { expect 1 1 }
}

test "beta three fails" {
	then { expect 1 2 }
}
`,
		};
		let sequentialRoot = await makeSuiteDir(files);
		let concurrentRoot = await makeSuiteDir(files);

		let sequential = await runSuite({
			root: sequentialRoot,
			grants: noGrants(),
			plugins: [createProbePlugin().plugin],
			concurrency: 1,
		});
		let concurrent = await runSuite({
			root: concurrentRoot,
			grants: noGrants(),
			plugins: [createProbePlugin().plugin],
			concurrency: 8,
		});
		if (isFailure(sequential)) throw new Error(sequential.error.message);
		if (isFailure(concurrent)) throw new Error(concurrent.error.message);

		// Compare the observable shape of each result, not the varying durations.
		function shape(suite: SuiteResult): { title: string; status: string; code?: string }[] {
			return suite.results.map((result) => ({
				title: result.title,
				status: result.status,
				code: result.error?.code,
			}));
		}
		let expectedOrder = [
			{ title: "alpha one", status: "passed", code: undefined },
			{ title: "alpha two", status: "passed", code: undefined },
			{ title: "beta one", status: "passed", code: undefined },
			{ title: "beta two", status: "passed", code: undefined },
			{ title: "beta three fails", status: "failed", code: "expectation-failed" },
		];
		expect(shape(sequential.data)).toEqual(expectedOrder);
		// Determinism: concurrency changes only the schedule, never the outcome
		// or its order — the two runs are identical.
		expect(shape(concurrent.data)).toEqual(shape(sequential.data));
		expect(concurrent.data.passed).toBe(sequential.data.passed);
		expect(concurrent.data.failed).toBe(sequential.data.failed);
	});

	test("the full dogfood suite stays green at --concurrency=8", async () => {
		// The acceptance layer under a non-default schedule: run the CLI's own
		// `.spec` suite through the workspace-linked `spec` bin (the same
		// `bun cli.ts` entry the gate uses) with `--concurrency=8`, and assert it
		// still passes with zero failures. `spec` is on PATH via the repo's
		// node_modules/.bin so the meta-tests can spawn nested `spec` children.
		let packageDir = resolve(import.meta.dir, "..");
		let binDir = resolve(packageDir, "..", "..", "node_modules", ".bin");
		let child = Bun.spawn({
			cmd: [
				join(binDir, "spec"),
				"run",
				"spec",
				"--allow-run=spec,echo",
				// spec/env.spec reads one real variable, which `cli.run` forwards to
				// its children only when it is granted by name here.
				"--allow-env=SPEC_ENV_FIXTURE",
				"--concurrency=8",
			],
			cwd: packageDir,
			env: {
				...process.env,
				PATH: `${binDir}:${process.env.PATH ?? ""}`,
				SPEC_ENV_FIXTURE: "fixture-value",
			},
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
		let [stdout, stderr, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		let report = `dogfood --concurrency=8 output:\n${stdout}${stderr}`;

		expect(exitCode, report).toBe(0);
		expect(stdout, report).not.toContain("✗");
		let summary = /(\d+) passed, (\d+) failed/.exec(stdout);
		expect(summary, report).not.toBeNull();
		expect(Number(summary?.[1]), report).toBeGreaterThan(0);
		expect(Number(summary?.[2]), report).toBe(0);
	}, 120_000);
});
