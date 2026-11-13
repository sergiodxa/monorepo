/**
 * Delta's seeded CI: the workflows, the runs and each run's jobs and steps. Runs are invented
 * but build real commits, picked by their place in the history, so every sha, subject and
 * date a run shows is git's; the newest run is always still going, timed from the request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { LogLine } from "@sdxc/ui/app/log-viewer";

import type { DeltaCommitMeta } from "~/app/services/delta/source";

import type { FailureSite } from "./logs";

import {
	build,
	check,
	checkout,
	completeJob,
	deploy,
	failingTests,
	install,
	passingTests,
	setUpJob,
	setupBun,
	upload,
} from "./logs";

/** A workflow's key, as the facet in the address writes it. */
export type WorkflowId = "ci" | "browser" | "deploy";

/** A workflow file in the repository. */
export interface Workflow {
	id: WorkflowId;
	name: string;
	file: string;
}

/** Every workflow, in the order the facet lists them. */
export const WORKFLOWS: readonly Workflow[] = [
	{ id: "ci", name: "CI", file: ".github/workflows/ci.yml" },
	{ id: "browser", name: "Browser tests", file: ".github/workflows/browser.yml" },
	{ id: "deploy", name: "Deploy", file: ".github/workflows/deploy.yml" },
];

/** Where a run stands; the list's status facet filters by it. */
export type RunStatus = "success" | "failure" | "cancelled" | "in_progress";

/** Where a job or a step stands, as the log viewer draws it. */
export type JobState = "success" | "failure" | "running" | "queued" | "skipped" | "cancelled";

/** What started a run. */
export type RunEvent = "push" | "pull_request" | "schedule" | "workflow_dispatch";

/** A run as the seed writes it, before it meets the history. */
interface RunSeed {
	id: number;
	workflow: WorkflowId;
	event: RunEvent;
	/** The commit it built by place in the history, 0 for the newest; wraps on a short history. */
	commit: number;
	branch: string;
	actor: string;
	status: RunStatus;
	/** Seconds after the commit the run started. */
	after: number;
	/** The pull request a `pull_request` run belongs to. */
	pr?: number;
}

/** Every run, newest first; ids are the workflow run numbers the addresses carry. */
const RUNS: readonly RunSeed[] = [
	{
		id: 815,
		workflow: "ci",
		event: "push",
		commit: 0,
		branch: "main",
		actor: "sergiodxa",
		status: "in_progress",
		after: 0,
	},
	{
		id: 814,
		workflow: "browser",
		event: "pull_request",
		commit: 0,
		branch: "delta/ci-screens",
		actor: "mara",
		status: "success",
		after: 1260,
		pr: 61,
	},
	{
		id: 813,
		workflow: "deploy",
		event: "push",
		commit: 1,
		branch: "main",
		actor: "sergiodxa",
		status: "success",
		after: 540,
	},
	{
		id: 812,
		workflow: "ci",
		event: "push",
		commit: 1,
		branch: "main",
		actor: "sergiodxa",
		status: "failure",
		after: 40,
	},
	{
		id: 811,
		workflow: "ci",
		event: "pull_request",
		commit: 1,
		branch: "delta/blame-ages",
		actor: "ines",
		status: "cancelled",
		after: 20,
		pr: 59,
	},
	{
		id: 810,
		workflow: "browser",
		event: "pull_request",
		commit: 1,
		branch: "delta/blame-ages",
		actor: "ines",
		status: "success",
		after: 380,
		pr: 59,
	},
	{
		id: 809,
		workflow: "deploy",
		event: "push",
		commit: 2,
		branch: "main",
		actor: "sergiodxa",
		status: "success",
		after: 610,
	},
	{
		id: 808,
		workflow: "ci",
		event: "push",
		commit: 2,
		branch: "main",
		actor: "sergiodxa",
		status: "success",
		after: 35,
	},
	{
		id: 807,
		workflow: "ci",
		event: "pull_request",
		commit: 2,
		branch: "delta/history-bake",
		actor: "kenji",
		status: "success",
		after: 15,
		pr: 57,
	},
	{
		id: 806,
		workflow: "browser",
		event: "schedule",
		commit: 2,
		branch: "main",
		actor: "tlindqvist",
		status: "success",
		after: 7200,
	},
	{
		id: 805,
		workflow: "ci",
		event: "workflow_dispatch",
		commit: 2,
		branch: "main",
		actor: "tlindqvist",
		status: "success",
		after: 5400,
	},
	{
		id: 804,
		workflow: "deploy",
		event: "workflow_dispatch",
		commit: 2,
		branch: "main",
		actor: "priya",
		status: "failure",
		after: 9000,
	},
];

/** One step of a job, with its log. */
export interface Step {
	name: string;
	state: JobState;
	/** Seconds it ran; none for a step that never started. */
	seconds?: number;
	lines: LogLine[];
}

/** One job of a run. */
export interface Job {
	/** The job's number in its run, from 1, as `job/<n>` addresses it. */
	n: number;
	name: string;
	/** The matrix it was expanded from, such as "test", which the graph draws as one group. */
	matrix?: string;
	/** The column of the job graph it sits in, from 0; a job waits for every earlier column. */
	stage: number;
	state: JobState;
	/** Seconds it ran so far, or in all once done. */
	seconds?: number;
	steps: Step[];
	/** Started, in epoch milliseconds; none while queued. */
	startedAt?: number;
}

/** A finding a run raised against a line of the repository, or against the run itself. */
export interface Annotation {
	level: "failure" | "warning";
	/** The job it came from, by number. */
	job: number;
	title: string;
	message: string;
	/** The anchor id in `anchors.ts` naming the cited lines, for a finding about code. */
	anchor?: string;
}

/** A file a run kept, listed with its size. */
export interface Artifact {
	name: string;
	size: string;
}

/** A run as the screens draw it: the seed joined to the real commit it built. */
export interface Run {
	id: number;
	workflow: Workflow;
	event: RunEvent;
	/** The commit's subject, which titles a run. */
	title: string;
	sha: string;
	branch: string;
	actor: string;
	status: RunStatus;
	pr?: number;
	/** Started, in epoch milliseconds. */
	startedAt: number;
	/** Seconds it ran so far, or in all once done. */
	seconds: number;
	jobs: Job[];
	annotations: Annotation[];
	artifacts: Artifact[];
}

/** The anchor the failing test's assertion is cited by. */
export const FAILURE_ANCHOR = "ci-phone-scroll";

/** The anchor the check's warning cites. */
export const WARNING_ANCHOR = "ci-utc-days";

/** How long the newest run has been going when a page draws it. */
const RUNNING_FOR = 154;

/** The running job's live step: its lines so far, and the ones the stream sends after them. */
export const LIVE = { run: 815, job: 4, step: 5, shown: 14 } as const;

/** A number from 0 to 1 picked from a seed, so a run's durations stay put between requests. */
function jitter(seed: number): number {
	let value = Math.sin(seed * 12.9898) * 43758.5453;
	return value - Math.floor(value);
}

/** The step names and logs of one kind of job. */
interface StepPlan {
	name: string;
	seconds: number;
	lines: string[];
}

/** What a job runs, step by step, from setup to cleanup. */
function stepsFor(
	kind: "install" | "check" | "test" | "browser" | "build" | "deploy",
	context: {
		job: string;
		sha: string;
		branch: string;
		shard?: string;
		failure?: FailureSite;
		warning?: { path: string; line: number; message: string };
		deployFailed?: boolean;
	},
): StepPlan[] {
	let { job, sha, branch, shard = "1/1" } = context;
	let opening: StepPlan[] = [
		{ name: "Set up job", seconds: 2, lines: setUpJob(job) },
		{ name: "Checkout", seconds: 3, lines: checkout(sha, branch) },
		{ name: "Set up Bun", seconds: 1, lines: setupBun() },
	];
	let closing: StepPlan = { name: "Complete job", seconds: 1, lines: completeJob() };
	let body: StepPlan[] = [];
	if (kind === "install") body = [{ name: "Install dependencies", seconds: 11, lines: install() }];
	if (kind === "check") {
		body = [
			{ name: "Install dependencies", seconds: 4, lines: install() },
			{ name: "Check", seconds: 9, lines: check(context.warning) },
		];
	}
	if (kind === "test" || kind === "browser") {
		let tests =
			context.failure === undefined
				? passingTests(shard, kind === "browser")
				: failingTests(shard, context.failure);
		body = [
			{ name: "Install dependencies", seconds: 4, lines: install() },
			{ name: "Run tests", seconds: kind === "browser" ? 48 : 31, lines: tests },
			{ name: "Upload report", seconds: 2, lines: upload("vitest-report", "1.2 MB") },
		];
	}
	if (kind === "build") {
		body = [
			{ name: "Install dependencies", seconds: 4, lines: install() },
			{ name: "Build", seconds: 21, lines: build() },
			{ name: "Upload build", seconds: 3, lines: upload("sdxc-site-dist", "4.8 MB") },
		];
	}
	if (kind === "deploy") {
		body = [{ name: "Deploy", seconds: 14, lines: deploy(context.deployFailed === true) }];
	}
	return [...opening, ...body, closing];
}

/** Numbers a step's raw lines and stamps each with the time it was written. */
function toLines(raw: string[], start: number, seconds: number): LogLine[] {
	let span = Math.max(1, seconds) * 1000;
	return raw.map((text, index) => ({
		n: index + 1,
		text,
		ts: new Date(start + Math.round((span * index) / Math.max(1, raw.length))).toISOString(),
	}));
}

/** A job's plan before its states are settled. */
interface JobPlan {
	name: string;
	matrix?: string;
	stage: number;
	kind: Parameters<typeof stepsFor>[0];
	shard?: string;
}

/** The jobs each workflow runs, in graph order. */
const JOB_PLANS: Record<WorkflowId, JobPlan[]> = {
	ci: [
		{ name: "Install", stage: 0, kind: "install" },
		{ name: "Check", stage: 1, kind: "check" },
		{ name: "Test (1/3)", matrix: "Test", stage: 1, kind: "browser", shard: "1/3" },
		{ name: "Test (2/3)", matrix: "Test", stage: 1, kind: "test", shard: "2/3" },
		{ name: "Test (3/3)", matrix: "Test", stage: 1, kind: "test", shard: "3/3" },
		{ name: "Build", stage: 2, kind: "build" },
	],
	browser: [
		{ name: "Install", stage: 0, kind: "install" },
		{ name: "Chromium (1/2)", matrix: "Chromium", stage: 1, kind: "browser", shard: "1/2" },
		{ name: "Chromium (2/2)", matrix: "Chromium", stage: 1, kind: "browser", shard: "2/2" },
	],
	deploy: [
		{ name: "Build", stage: 0, kind: "build" },
		{ name: "Deploy to Cloudflare", stage: 1, kind: "deploy" },
	],
};

/** Each job's state in a run that ended a given way, by job number. */
function jobState(seed: RunSeed, n: number, stage: number): JobState {
	if (seed.status === "success") return "success";
	if (seed.status === "cancelled") return stage === 0 ? "success" : "cancelled";
	if (seed.status === "failure") {
		if (seed.workflow === "deploy") return n === 2 ? "failure" : "success";
		if (n === 3) return "failure";
		return stage === 2 ? "skipped" : "success";
	}
	if (n === LIVE.job) return "running";
	return stage === 0 || n < LIVE.job ? "success" : "queued";
}

/** What the run's real-line findings cite, resolved from the anchors. */
export interface RunSites {
	failure?: FailureSite;
	warning?: { path: string; line: number };
}

/** Builds one job's steps, states and times; `full` keeps a running step's whole log. */
function buildJob(
	seed: RunSeed,
	plan: JobPlan,
	n: number,
	sha: string,
	start: number,
	sites: RunSites,
	full = false,
): Job {
	let state = jobState(seed, n, plan.stage);
	let failing = state === "failure" && plan.kind !== "deploy" ? sites.failure : undefined;
	let warning =
		seed.id === 812 && plan.kind === "check" && sites.warning !== undefined
			? { ...sites.warning, message: WARNING_MESSAGE }
			: undefined;
	let plans = stepsFor(plan.kind, {
		job: plan.name,
		sha,
		branch: seed.branch,
		shard: plan.shard,
		failure: failing,
		warning,
		deployFailed: state === "failure",
	});
	let failedStep = plans.length - 2;
	if (plan.kind === "test" || plan.kind === "browser") failedStep = plans.length - 3;
	let liveStep = state === "running" ? LIVE.step - 1 : -1;
	let at = start;
	let steps: Step[] = plans.map((step, index) => {
		let scale = 0.8 + jitter(seed.id * 31 + n * 7 + index) * 0.5;
		let seconds = Math.max(1, Math.round(step.seconds * scale));
		let stepState = stepStateOf(state, index, failedStep, liveStep);
		let lines =
			stepState === "queued" || stepState === "skipped" || stepState === "cancelled"
				? []
				: toLines(step.lines, at, seconds);
		if (stepState === "running" && !full) lines = lines.slice(0, LIVE.shown);
		let ran = lines.length > 0 && stepState !== "running";
		if (lines.length > 0) at += seconds * 1000;
		return { name: step.name, state: stepState, seconds: ran ? seconds : undefined, lines };
	});
	let waiting = state === "queued" || state === "skipped";
	return {
		n,
		name: plan.name,
		matrix: plan.matrix,
		stage: plan.stage,
		state,
		seconds: waiting ? undefined : Math.round((at - start) / 1000),
		steps,
		startedAt: waiting ? undefined : start,
	};
}

/** Builds a run's jobs stage by stage, each stage starting once the slowest job before it ends. */
function buildJobs(seed: RunSeed, sha: string, startedAt: number, sites: RunSites): Job[] {
	let jobs: Job[] = [];
	let at = startedAt;
	let plans = JOB_PLANS[seed.workflow];
	let stages = Math.max(...plans.map((plan) => plan.stage)) + 1;
	for (let stage = 0; stage < stages; stage++) {
		let built = plans.flatMap((plan, index) =>
			plan.stage === stage ? [buildJob(seed, plan, index + 1, sha, at, sites)] : [],
		);
		jobs.push(...built);
		at += (Math.max(0, ...built.map((job) => job.seconds ?? 0)) + 4) * 1000;
	}
	return jobs.sort((a, b) => a.n - b.n);
}

/** A step's state from its job's: a failed job fails at its failing step and skips the rest. */
function stepStateOf(job: JobState, index: number, failedStep: number, liveStep: number): JobState {
	if (job === "success") return "success";
	if (job === "queued" || job === "skipped") return job;
	if (job === "cancelled") return index === 0 ? "success" : "cancelled";
	if (job === "running") {
		if (index < liveStep) return "success";
		return index === liveStep ? "running" : "queued";
	}
	if (index < failedStep) return "success";
	if (index === failedStep) return "failure";
	return index === failedStep + 1 ? "skipped" : "success";
}

/** The message the check's warning carries, citing the real day-grouping code. */
const WARNING_MESSAGE =
	"delta/utc-days: Commits are grouped by their UTC day, so one made at 21:00 in UTC−5 lists under the next day.";

/**
 * The running step's whole log, from its first line, for the stream to send what the page has
 * not drawn yet; none when there is no running run.
 */
export function liveStepLines(run: Run): LogLine[] {
	let seed = RUNS.find((candidate) => candidate.id === run.id);
	let job = run.jobs.find((candidate) => candidate.n === LIVE.job);
	let plan = JOB_PLANS.ci[LIVE.job - 1];
	if (seed === undefined || job?.startedAt === undefined || plan === undefined) return [];
	let full = buildJob(seed, plan, LIVE.job, run.sha, job.startedAt, {}, true);
	return full.steps[LIVE.step - 1]?.lines ?? [];
}

/**
 * Every run, joined to the history: each takes the subject and sha of the commit it built, and
 * starts before the run listed above it. The newest run started
 * {@link RUNNING_FOR} seconds before `now` and is still going.
 *
 * @param commits The history, newest first; no runs when it is empty.
 * @param now The request's time, in epoch milliseconds.
 * @param sites The real lines the failing run's findings cite.
 */
export function buildRuns(
	commits: readonly DeltaCommitMeta[],
	now: number,
	sites: RunSites = {},
): Run[] {
	if (commits.length === 0) return [];
	let newer = now;
	return RUNS.map((seed) => {
		let commit = commits[seed.commit % commits.length]!;
		let workflow = WORKFLOWS.find((candidate) => candidate.id === seed.workflow)!;
		let gap = (240 + Math.round(jitter(seed.id) * 900)) * 1000;
		let startedAt =
			seed.status === "in_progress"
				? now - RUNNING_FOR * 1000
				: Math.min(Date.parse(commit.date) + seed.after * 1000, newer - gap);
		newer = startedAt;
		let jobs = buildJobs(seed, commit.sha, startedAt, sites);
		let ended = Math.max(
			...jobs.map((job) => (job.startedAt ?? startedAt) + (job.seconds ?? 0) * 1000),
		);
		let seconds = seed.status === "in_progress" ? RUNNING_FOR : (ended - startedAt) / 1000;
		let annotations: Annotation[] = [];
		if (seed.id === 812) {
			annotations = [
				{
					level: "failure",
					job: 3,
					title: "Test (1/3)",
					message: "AssertionError: expected 391 to be less than or equal to 375",
					anchor: FAILURE_ANCHOR,
				},
				{
					level: "warning",
					job: 2,
					title: "Check",
					message: WARNING_MESSAGE,
					anchor: WARNING_ANCHOR,
				},
			];
		}
		if (seed.id === 804) {
			annotations = [
				{
					level: "failure",
					job: 2,
					title: "Deploy to Cloudflare",
					message: "Script startup exceeded CPU time limit. [code: 10021]",
				},
			];
		}
		let artifacts: Artifact[] = [];
		if (
			seed.workflow !== "deploy" &&
			seed.status !== "cancelled" &&
			seed.status !== "in_progress"
		) {
			artifacts.push({ name: "vitest-report", size: "1.2 MB" });
		}
		if (seed.workflow !== "browser" && seed.status === "success") {
			artifacts.push({ name: "sdxc-site-dist", size: "4.8 MB" });
		}
		return {
			id: seed.id,
			workflow,
			event: seed.event,
			title: commit.subject,
			sha: commit.sha,
			branch: seed.branch,
			actor: seed.actor,
			status: seed.status,
			pr: seed.pr,
			startedAt,
			seconds: Math.round(seconds),
			jobs,
			annotations,
			artifacts,
		};
	});
}

/** A duration as a run writes it: `48s`, `3m 12s`. */
export function formatDuration(seconds: number): string {
	let whole = Math.max(0, Math.round(seconds));
	if (whole < 60) return `${whole}s`;
	let minutes = Math.floor(whole / 60);
	let rest = whole % 60;
	return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
