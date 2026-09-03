/**
 * Tests for the suite runner: real suite directories on disk, the real
 * built-in plugins, per-test workspaces, and grants flowing into the central
 * permission gate — the whole run path short of the CLI.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { failure, isFailure, success } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import type { SuiteResult } from "./diagnostics.js";
import type { Grants } from "./permissions.js";
import type { Plugin } from "./plugin.js";
import type { Value } from "./values.js";

import { PermissionDeniedError, ToolError } from "./errors.js";
import { runSuite } from "./runner.js";

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

	/**
	 * The error's file always names where the failing statement is written,
	 * even when a different file invoked the command, since the span only
	 * resolves against that file's text.
	 */
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
		expect(result?.error?.file).toBe(join(root, "commands/helper.spec"));
	});

	/**
	 * A denial must reach the caller before any process spawns; letting the
	 * spawn attempt happen first would surface as a generic tool error
	 * instead of a permission denial.
	 */
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
 * A test plugin whose tool `probe.wait` sleeps for N milliseconds while
 * tracking concurrent calls: `maxActive` climbs above 1 only when two
 * waits actually overlap, and the recorded intervals expose that overlap.
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
			await sleep(ms);
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
	/**
	 * With three slots and equal 120ms sleeps, every worker enters before any
	 * exits, so the last start precedes the first end and all three
	 * intervals overlap — proof the runner actually ran them concurrently.
	 */
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
		expect(probe.maxActive()).toBeGreaterThanOrEqual(2);
		let spans = probe.intervals();
		let latestStart = Math.max(...spans.map((span) => span.start));
		let earliestEnd = Math.min(...spans.map((span) => span.end));
		expect(latestStart).toBeLessThan(earliestEnd);
	});

	/**
	 * Omitting the concurrency option defaults to 1, so only one wait is
	 * ever in flight and each interval ends before the next begins.
	 */
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

		let run = await runSuite({ root, grants: noGrants(), plugins: [probe.plugin] });
		if (isFailure(run)) throw new Error(run.error.message);

		expect(run.data.passed).toBe(2);
		expect(probe.maxActive()).toBe(1);
		let spans = probe.intervals();
		expect(spans[0]?.end).toBeLessThanOrEqual(spans[1]?.start ?? 0);
	});

	/**
	 * Three overlapping 120ms waits finish the run in about one wait, so the
	 * summary's wall-clock reports elapsed time and stays below the sum of
	 * the per-test durations it also records.
	 */
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
		let summed = run.data.results.reduce((total, result) => total + result.durationMs, 0);
		expect(run.data.wallMs).toBeLessThan(summed);
	});

	/**
	 * At concurrency one the waits never overlap, so the wall-clock spans
	 * both end to end and is at least their summed durations — confirming
	 * wall-clock reporting stays accurate at the default concurrency too.
	 */
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
		let summed = run.data.results.reduce((total, result) => total + result.durationMs, 0);
		expect(run.data.wallMs).toBeGreaterThanOrEqual(summed);
	});

	/**
	 * Waits finish out of source order under concurrency, so results are
	 * checked against a source-ordered expectation, and running at
	 * concurrency 1 and 8 confirms concurrency changes only the schedule.
	 */
	test("output is byte-for-byte source-ordered at concurrency 1 and 8", async () => {
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

		/**
		 * Extracts each result's title, status, and error code so shapes
		 * stay comparable across differently-timed runs.
		 */
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
		expect(shape(concurrent.data)).toEqual(shape(sequential.data));
		expect(concurrent.data.passed).toBe(sequential.data.passed);
		expect(concurrent.data.failed).toBe(sequential.data.failed);
	});

	/**
	 * Runs the CLI's own `.spec` suite through the published `spec` bin at
	 * `--concurrency=8`; `--allow-env=SPEC_ENV_FIXTURE` grants only the one
	 * variable spec/env.spec reads, confirming named-only env forwarding.
	 */
	test("the full dogfood suite stays green at --concurrency=8", async () => {
		let packageDir = resolve(import.meta.dirname, "..");
		let binDir = resolve(packageDir, "..", "..", "node_modules", ".bin");
		let child = spawn(
			join(binDir, "spec"),
			["run", "spec", "--allow-run=spec,echo", "--allow-env=SPEC_ENV_FIXTURE", "--concurrency=8"],
			{
				cwd: packageDir,
				env: {
					...process.env,
					PATH: `${binDir}:${process.env.PATH ?? ""}`,
					SPEC_ENV_FIXTURE: "fixture-value",
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		let stdout = "";
		let stderr = "";
		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => void (stdout += chunk));
		child.stderr?.on("data", (chunk: string) => void (stderr += chunk));
		let exitCode = await new Promise<number>((settle, reject) => {
			child.once("error", reject);
			child.once("close", (code: number | null) => settle(code ?? 1));
		});
		let report = `dogfood --concurrency=8 output:\n${stdout}${stderr}`;

		expect(exitCode, report).toBe(0);
		expect(stdout, report).not.toContain("✗");
		let summary = /(\d+) passed, (\d+) failed/.exec(stdout);
		expect(summary, report).not.toBeNull();
		expect(Number(summary?.[1]), report).toBeGreaterThan(0);
		expect(Number(summary?.[2]), report).toBe(0);
	}, 120_000);
});

describe("generated data", () => {
	/**
	 * A plugin that keeps every value a suite hands it, so a test can assert on
	 * data the suite generated without pinning it in the `.spec` file.
	 */
	function makeRecorder(): { plugin: Plugin; seen: Value[] } {
		let seen: Value[] = [];
		return {
			seen,
			plugin: {
				namespace: "probe",
				describe: () => [
					{
						name: "record",
						summary: "Keep a value for the test harness to read.",
						kind: "action",
						params: [
							{ name: "value", kind: "value", required: true, summary: "The value to keep." },
						],
					},
				],
				async call(tool, args) {
					let argument = args[0];
					if (tool !== "record" || argument === undefined || argument.kind !== "value") {
						return failure(new ToolError("probe.record takes one value."));
					}
					seen.push(argument.value);
					return success(argument.value);
				},
			},
		};
	}

	/** A suite of `count` tests, each recording an address it generated. */
	function generatingSuite(count: number): Record<string, string> {
		let tests = Array.from(
			{ length: count },
			(_, index) => `test "generates ${index}" {
	when {
		let person = sample.person
	}
	then {
		record person.email
	}
}
`,
		);
		return { "generate.spec": `use sample\nuse probe\n\n${tests.join("\n")}` };
	}

	async function collect(root: string, seed?: string, concurrency?: number): Promise<Value[]> {
		let recorder = makeRecorder();
		let result = await runSuite({
			root,
			grants: deniedGrants(),
			plugins: [recorder.plugin],
			seed,
			concurrency,
		});
		if (isFailure(result)) throw new Error(`Expected the run to start: ${result.error.message}`);
		expect(result.data.failed).toBe(0);
		return recorder.seen;
	}

	test("gives a test the same data on every run", async () => {
		let root = await makeSuiteDir(generatingSuite(1));

		expect(await collect(root)).toEqual(await collect(root));
	});

	test("holds a suite's data still wherever the suite lives", async () => {
		let here = await makeSuiteDir(generatingSuite(1));
		let there = await makeSuiteDir(generatingSuite(1));

		expect(await collect(here)).toEqual(await collect(there));
	});

	test("gives different seeds different data", async () => {
		let root = await makeSuiteDir(generatingSuite(1));

		expect(await collect(root, "one")).not.toEqual(await collect(root, "two"));
	});

	test("gives each test in a file its own data", async () => {
		let root = await makeSuiteDir(generatingSuite(4));
		let seen = await collect(root);

		expect(new Set(seen).size).toBe(4);
	});

	test("holds a test's data still whatever the concurrency", async () => {
		let root = await makeSuiteDir(generatingSuite(6));
		let sequential = await collect(root, undefined, 1);
		let concurrent = await collect(root, undefined, 6);

		let order = (left: Value, right: Value) =>
			JSON.stringify(left).localeCompare(JSON.stringify(right));

		expect([...concurrent].sort(order)).toEqual([...sequential].sort(order));
	});

	test("keeps a test's data when the tests around it are removed", async () => {
		let whole = await makeSuiteDir({
			"generate.spec": `use sample
use probe

test "first" {
	when {
		let person = sample.person
	}
	then {
		record person.email
	}
}

test "second" {
	when {
		let person = sample.person
	}
	then {
		record person.email
	}
}
`,
		});
		let alone = await makeSuiteDir({
			"generate.spec": `use sample
use probe

test "second" {
	when {
		let person = sample.person
	}
	then {
		record person.email
	}
}
`,
		});

		let both = await collect(whole);
		let one = await collect(alone);

		expect(one).toEqual([both[1]]);
	});
});
