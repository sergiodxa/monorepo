/**
 * Tests for run records: the report and per-step logs a run leaves, how many runs are kept, and
 * what a later run reads back — the failed labels and each matrix entry's duration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { isFailure } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import type { RunReport, StepRecord } from "./run.js";

import {
	entryDurations,
	failedLabels,
	KEPT_RUNS,
	lastRun,
	recordRun,
	runsDirectory,
	slugOf,
} from "./runs.js";

/** Directories made by `gitDirectory`, removed after each test. */
const CREATED: string[] = [];

afterEach(async () => {
	for (let dir of CREATED.splice(0)) await rm(dir, { recursive: true, force: true });
});

/** An empty directory standing in for a clone's shared git directory. */
async function gitDirectory(): Promise<string> {
	let dir = await realpath(await mkdtemp(join(tmpdir(), "sdxc-ci-runs-")));
	CREATED.push(dir);
	return dir;
}

/** A finished step with `overrides` over a passing, unfiltered one. */
function step(label: string, overrides: Partial<StepRecord> = {}): StepRecord {
	return {
		name: label,
		label,
		addresses: [label],
		entry: null,
		filtered: false,
		status: "passed",
		cached: false,
		duration: 10,
		output: "",
		attempts: 1,
		flaky: false,
		...overrides,
	};
}

/** A finished run holding `steps`. */
function reportOf(steps: StepRecord[]): RunReport {
	return {
		status: steps.some((each) => each.status === "failed") ? "failing" : "passing",
		exitCode: steps.some((each) => each.status === "failed") ? 1 : 0,
		runner: "local",
		partial: false,
		duration: 100,
		steps,
		entries: [],
		errors: [],
		closing: null,
		signoff: null,
		treeProblem: null,
	};
}

/** Records `report` and answers its directory, failing the test when it cannot. */
async function record(git: string, report: RunReport): Promise<string> {
	let recorded = await recordRun(git, report);
	expect(isFailure(recorded)).toBe(false);
	return isFailure(recorded) ? "" : recorded.data;
}

describe("recordRun", () => {
	test("writes the report and a numbered log for each step that ran with output", async () => {
		let git = await gitDirectory();
		let directory = await record(
			git,
			reportOf([
				step("Lint", { output: "all clean\n" }),
				step("Format"),
				step("Skipped", { filtered: true, output: "never shown" }),
				step("Apps/blog Test blog", { entry: "Apps/blog", status: "failed", output: "boom\n" }),
			]),
		);
		expect(dirname(directory)).toBe(runsDirectory(git));
		expect((await readdir(join(directory, "logs"))).sort()).toEqual([
			"01-lint.log",
			"03-apps-blog-test-blog.log",
		]);
		expect(await readFile(join(directory, "logs", "03-apps-blog-test-blog.log"), "utf8")).toBe(
			"boom\n",
		);
		let report = JSON.parse(await readFile(join(directory, "report.json"), "utf8")) as {
			steps: Array<{ label: string }>;
		};
		expect(report.steps.map((each) => each.label)).toEqual([
			"Lint",
			"Format",
			"Apps/blog Test blog",
		]);
	});

	test("keeps only the newest runs", async () => {
		let git = await gitDirectory();
		let first = await record(git, reportOf([step("Lint")]));
		let last = "";
		for (let index = 0; index < KEPT_RUNS; index++) {
			last = await record(git, reportOf([step("Lint")]));
		}
		let ids = await readdir(runsDirectory(git));
		expect(ids).toHaveLength(KEPT_RUNS);
		expect(ids).not.toContain(basename(first));
		expect(ids).toContain(basename(last));
	});
});

describe("lastRun", () => {
	test("is null when no run was recorded", async () => {
		expect(await lastRun(await gitDirectory())).toBeNull();
	});

	test("reads the newest run, passing over one whose report is unreadable", async () => {
		let git = await gitDirectory();
		await record(git, reportOf([step("Old", { status: "failed" })]));
		await record(git, reportOf([step("New", { status: "failed" })]));
		let broken = join(runsDirectory(git), "ffffffff-ffff-7fff-bfff-ffffffffffff");
		await mkdir(broken, { recursive: true });
		await writeFile(join(broken, "report.json"), "{ not json");
		let run = await lastRun(git);
		expect(run === null ? null : failedLabels(run)).toEqual(["New"]);
	});
});

describe("failedLabels and entryDurations", () => {
	test("answer the failed steps and each matrix entry's summed duration", async () => {
		let git = await gitDirectory();
		await record(
			git,
			reportOf([
				step("Lint", { duration: 5 }),
				step("Apps/blog Build", { entry: "Apps/blog", duration: 30 }),
				step("Apps/blog Test", { entry: "Apps/blog", duration: 12, status: "failed" }),
				step("Apps/shop Build", { entry: "Apps/shop", duration: 7 }),
			]),
		);
		let run = await lastRun(git);
		expect(run).not.toBeNull();
		if (run === null) return;
		expect(failedLabels(run)).toEqual(["Apps/blog Test"]);
		expect(entryDurations(run)).toEqual(
			new Map([
				["Apps/blog", 42],
				["Apps/shop", 7],
			]),
		);
	});
});

describe("slugOf", () => {
	test("keeps letters and digits joined by single dashes", () => {
		expect(slugOf("Workspaces/@acme/ui Test (unit)")).toBe("workspaces-acme-ui-test-unit");
		expect(slugOf("***")).toBe("step");
	});
});
