/**
 * Records of finished runs under the clone's shared git directory: the JSON report and one log
 * file per step, so a failure's full output survives the terminal, `--rerun-failed` knows which
 * steps to run again, and the next run starts the slowest matrix entries first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";
import * as s from "remix/data-schema";

import type { RunReport } from "./run.js";

import { jsonReport } from "./report.js";

/** How many runs stay recorded; older run directories are removed when a new one is written. */
export const KEPT_RUNS = 20;

/** Longest slug a log file name takes from its step's label, so names stay readable. */
const SLUG_LENGTH = 60;

/** The fields of a recorded report the next run reads back; any other field is kept as written. */
const RECORDED_RUN_SCHEMA = s.object({
	steps: s.array(
		s.object({
			label: s.string(),
			entry: s.nullable(s.string()),
			status: s.string(),
			duration: s.number(),
		}),
	),
});

/** A step as a recorded run reports it. */
export interface RecordedStep {
	label: string;
	/** The matrix entry address, `<matrix>/<key>`, or `null` outside a matrix. */
	entry: string | null;
	status: string;
	duration: number;
}

/** The part of a recorded run's report a later run relies on. */
export interface RecordedRun {
	/** The steps the run took; steps its filters left out are absent. */
	steps: RecordedStep[];
}

/** The directory every run's record sits in. */
export function runsDirectory(gitDirectory: string): string {
	return join(gitDirectory, "sdxc-ci", "runs");
}

/** A label as a file name part: lowercase letters and digits joined by single dashes. */
export function slugOf(label: string): string {
	let slug = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.slice(0, SLUG_LENGTH)
		.replace(/^-+|-+$/g, "");
	return slug === "" ? "step" : slug;
}

/**
 * Writes `report` as `runs/<id>/report.json`, and each step that ran with output as
 * `runs/<id>/logs/<NN>-<slug>.log`, numbered in run order. Ids are time-ordered, so the newest
 * {@link KEPT_RUNS} directories survive and older ones are removed.
 *
 * @returns The run's directory, which holds the report and its `logs` folder.
 */
export async function recordRun(
	gitDirectory: string,
	report: RunReport,
): Promise<Result<string, Error>> {
	let directory = join(runsDirectory(gitDirectory), generateUUID());
	let logs = join(directory, "logs");
	let made = await wrap(() => mkdir(logs, { recursive: true }));
	if (isFailure(made)) return failure(made.error);
	let steps = report.steps.filter((step) => !step.filtered);
	for (let [index, step] of steps.entries()) {
		if (step.output === "") continue;
		let name = `${String(index + 1).padStart(2, "0")}-${slugOf(step.label)}.log`;
		let written = await wrap(() => writeFile(join(logs, name), step.output));
		if (isFailure(written)) return failure(written.error);
	}
	let text = `${JSON.stringify(jsonReport(report), null, 2)}\n`;
	let written = await wrap(() => writeFile(join(directory, "report.json"), text));
	if (isFailure(written)) return failure(written.error);
	await pruneRuns(gitDirectory);
	return success(directory);
}

/** Every recorded run's id, oldest first; an unreadable directory has none. */
async function runIds(gitDirectory: string): Promise<string[]> {
	let listed = await wrap(() => readdir(runsDirectory(gitDirectory), { withFileTypes: true }));
	if (isFailure(listed)) return [];
	return listed.data
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

/** Removes every run directory but the newest {@link KEPT_RUNS}. */
async function pruneRuns(gitDirectory: string): Promise<void> {
	let ids = await runIds(gitDirectory);
	for (let id of ids.slice(0, Math.max(0, ids.length - KEPT_RUNS))) {
		await wrap(() => rm(join(runsDirectory(gitDirectory), id), { recursive: true, force: true }));
	}
}

/**
 * The newest run whose report reads back, or `null` when none was recorded. A report that is
 * missing or malformed is passed over for the one before it.
 */
export async function lastRun(gitDirectory: string): Promise<RecordedRun | null> {
	let ids = await runIds(gitDirectory);
	for (let id of ids.reverse()) {
		let text = await wrap(() =>
			readFile(join(runsDirectory(gitDirectory), id, "report.json"), "utf8"),
		);
		if (isFailure(text)) continue;
		let json = wrap((): unknown => JSON.parse(text.data));
		if (isFailure(json)) continue;
		let parsed = s.parseSafe(RECORDED_RUN_SCHEMA, json.data);
		if (parsed.success) return parsed.value;
	}
	return null;
}

/** The labels of the steps that failed in `run`, in run order; the labels `--rerun-failed` runs. */
export function failedLabels(run: RecordedRun): string[] {
	return run.steps.filter((step) => step.status === "failed").map((step) => step.label);
}

/**
 * Milliseconds each matrix entry of `run` took, as the sum of its steps' durations, by entry
 * address; steps outside a matrix count toward no entry.
 */
export function entryDurations(run: RecordedRun): Map<string, number> {
	let durations = new Map<string, number>();
	for (let step of run.steps) {
		if (step.entry === null) continue;
		durations.set(step.entry, (durations.get(step.entry) ?? 0) + step.duration);
	}
	return durations;
}
