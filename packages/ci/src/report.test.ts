/**
 * Tests for how a run reads: the step line and summary for flaky steps, the JSON form, the live
 * status line on a terminal (with a fake clock and timer), GitHub Actions groups and annotations,
 * and the job summary a run appends on GitHub Actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isSuccess } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import type { RunReport, StepRecord } from "./run.js";

import { runAction } from "./cli-actions.js";
import {
	actionsReporter,
	appendStepSummary,
	formatRunning,
	formatStep,
	formatStepSummary,
	formatSummary,
	jsonReport,
	PLAIN,
	progressReporter,
} from "./report.js";
import { createRepo, removeRepos } from "./test-repo.js";

/** Temporary directories a test made, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	await removeRepos();
	for (let directory of DIRECTORIES.splice(0)) await rm(directory, { recursive: true });
});

/** A finished step that passed on its first attempt, with `overrides` applied. */
function step(overrides: Partial<StepRecord> = {}): StepRecord {
	return {
		name: "Lint",
		label: "Lint",
		addresses: ["Lint"],
		entry: null,
		filtered: false,
		status: "passed",
		cached: false,
		duration: 1200,
		output: "",
		attempts: 1,
		flaky: false,
		...overrides,
	};
}

/** A finished passing run holding `steps`, with `overrides` applied. */
function report(steps: StepRecord[], overrides: Partial<RunReport> = {}): RunReport {
	return {
		status: "passing",
		exitCode: 0,
		runner: "local",
		partial: false,
		duration: 5000,
		steps,
		entries: [],
		errors: [],
		closing: null,
		signoff: null,
		treeProblem: null,
		...overrides,
	};
}

/** A sink collecting everything a reporter writes. */
function sink() {
	let written: string[] = [];
	return { written, write: (text: string) => void written.push(text) };
}

describe("flaky steps", () => {
	let flaky = step({ label: "Tests", attempts: 3, flaky: true });

	test("formatStep marks a passed-on-retry step with its attempt count", () => {
		expect(formatStep(flaky, PLAIN, false)).toBe("✓ Tests  1.2s  flaky, passed on attempt 3\n");
	});

	test("formatSummary counts and lists flaky steps", () => {
		let summary = formatSummary(report([step(), flaky]), PLAIN);
		expect(summary).toContain("✓ passing — 2 steps passed, 1 flaky (5.0s)");
		expect(summary).toContain("  ! Tests  flaky, passed on attempt 3");
	});

	test("jsonReport includes attempts and flaky for each step", () => {
		let json = jsonReport(report([flaky])) as { steps: Array<Record<string, unknown>> };
		expect(json.steps[0]).toMatchObject({ label: "Tests", attempts: 3, flaky: true });
	});
});

describe("formatRunning", () => {
	test("names every running step with its elapsed time, oldest first", () => {
		let running = [
			{ label: "Tests/root", startedAt: 0 },
			{ label: "Lint", startedAt: 369_000 },
		];
		expect(formatRunning(running, 372_000, 80)).toBe("⠿ 2 running: Tests/root 6m 12s, Lint 3s");
	});

	test("collapses steps that do not fit into a count", () => {
		let running = ["Alpha", "Beta", "Gamma", "Delta"].map((label) => ({ label, startedAt: 0 }));
		let line = formatRunning(running, 1000, 40);
		expect(line).toBe("⠿ 4 running: Alpha 1s, Beta 1s, +2 more");
		expect(line.length).toBeLessThan(40);
	});

	test("cuts a first step too long for the line", () => {
		let running = [{ label: "x".repeat(100), startedAt: 0 }];
		let line = formatRunning(running, 0, 30);
		expect(line.length).toBe(29);
		expect(line.endsWith("…")).toBe(true);
	});
});

describe("progressReporter", () => {
	/** A progress reporter on a fake clock and timer, and what it wrote. */
	function progress() {
		let clock = { now: 0 };
		let timer = { tick: null as (() => void) | null, stopped: false };
		let output = sink();
		let reporter = progressReporter(output.write, PLAIN, false, {
			now: () => clock.now,
			columns: () => 80,
			schedule: (tick) => {
				timer.tick = tick;
				return () => {
					timer.stopped = true;
				};
			},
		});
		return { clock, timer, written: output.written, reporter };
	}

	test("keeps a status line under finished steps and clears it at the end", () => {
		let { clock, timer, written, reporter } = progress();
		reporter.started?.({ label: "Lint", startedAt: 0 });
		reporter.started?.({ label: "Tests", startedAt: 0 });
		clock.now = 2000;
		timer.tick?.();
		reporter.step(step({ label: "Lint", duration: 2000 }));
		reporter.finished?.(report([]));
		expect(written).toEqual([
			"⠿ 1 running: Lint 0s",
			"\r\x1b[2K⠿ 2 running: Lint 0s, Tests 0s",
			"\r\x1b[2K⠿ 2 running: Lint 2s, Tests 2s",
			"\r\x1b[2K✓ Lint  2.0s\n⠿ 1 running: Tests 2s",
			"\r\x1b[2K",
		]);
		expect(timer.stopped).toBe(true);
	});

	test("prints steps that never started without a status line", () => {
		let { written, reporter } = progress();
		reporter.step(step({ cached: true }));
		reporter.finished?.(report([]));
		expect(written).toEqual(["✓ Lint  cached (1.2s)\n"]);
	});
});

describe("actionsReporter", () => {
	test("groups each step's output and annotates a failure", () => {
		let { written, write } = sink();
		let reporter = actionsReporter(write);
		reporter.step(step({ output: "all good\n" }));
		reporter.step(
			step({ label: "Test, 100%", status: "failed", output: "\n  expected 1: to be 2\nmore\n" }),
		);
		expect(written.join("")).toBe(
			[
				"::group::✓ Lint  1.2s",
				"all good",
				"::endgroup::",
				"::group::✗ Test, 100%  1.2s",
				"",
				"  expected 1: to be 2",
				"more",
				"::endgroup::",
				"::error title=Test%2C 100%25::expected 1: to be 2",
				"",
			].join("\n"),
		);
	});

	test("annotates a failure without output as failed, and escapes a script error", () => {
		let { written, write } = sink();
		let reporter = actionsReporter(write);
		reporter.step(step({ status: "failed" }));
		reporter.error({ where: null, message: "boom\r\nat line 2" });
		expect(written.join("")).toContain("::error title=Lint::failed\n");
		expect(written.join("")).toContain(
			"::error title=script threw outside a step::boom%0D%0Aat line 2\n",
		);
	});
});

describe("job summary", () => {
	test("formatStepSummary tables the steps that ran", () => {
		let markdown = formatStepSummary(
			report(
				[
					step({ cached: true }),
					step({ label: "a|b", status: "failed", attempts: 2 }),
					step({ label: "Flaky", attempts: 2, flaky: true }),
					step({ label: "Later", status: "skipped" }),
					step({ label: "Hidden", filtered: true }),
				],
				{ status: "failing", exitCode: 1 },
			),
		);
		expect(markdown).toBe(
			[
				"### ❌ CI failing: 1 of 4 steps failed, 1 flaky, 1 cached, 1 filtered out (5.0s)",
				"",
				"| Status | Step | Duration | Notes |",
				"| --- | --- | --- | --- |",
				"| ✅ passed | Lint | 1.2s | cached |",
				"| ❌ failed | a\\|b | 1.2s |  |",
				"| ✅ passed | Flaky | 1.2s | flaky, passed on attempt 2 |",
				"",
				"",
			].join("\n"),
		);
	});

	test("appendStepSummary adds to what the file already holds", async () => {
		let directory = await mkdtemp(join(tmpdir(), "sdxc-ci-summary-"));
		DIRECTORIES.push(directory);
		let path = join(directory, "summary.md");
		await writeFile(path, "Earlier\n");
		let appended = await appendStepSummary(path, report([step()]));
		expect(isSuccess(appended)).toBe(true);
		expect(await readFile(path, "utf8")).toBe(`Earlier\n${formatStepSummary(report([step()]))}`);
	});

	test("runAction on GitHub Actions prints groups and writes the job summary", async () => {
		let root = await createRepo({
			"package.json": "{}\n",
			"ci.ts": `export default async (ci) => {
	await ci.step("Lint", "echo linted");
	await ci.step("Test", "echo 'expected 1 to be 2' && exit 1");
};
`,
		});
		let summary = join(root, "summary.md");
		let output = sink();
		let result = await runAction(
			{
				cwd: root,
				env: { CI: "true", GITHUB_ACTIONS: "true", GITHUB_STEP_SUMMARY: summary },
				stdout: output.write,
				interactive: true,
			},
			"ci.ts",
			{ signoff: false, cache: false },
		);
		expect(isSuccess(result)).toBe(false);
		let printed = output.written.join("");
		expect(printed).toMatch(/::group::✓ Lint {2}\d+\.\ds\nlinted\n::endgroup::\n/);
		expect(printed).toContain("::error title=Test::expected 1 to be 2\n");
		expect(printed).not.toContain("\x1b[2K");
		let markdown = await readFile(summary, "utf8");
		expect(markdown).toContain("### ❌ CI failing: 1 of 2 steps failed");
		expect(markdown).toMatch(/\| ✅ passed \| Lint \| \d+\.\ds \| {2}\|/);
	});
});
