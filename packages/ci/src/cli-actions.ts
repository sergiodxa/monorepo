/**
 * What each `sdxc-ci` command does, written against plain inputs instead of a command context,
 * so the `sdxc-ci` handlers and any tool wrapping them (one that finds the script or installs
 * dependencies first) run exactly the same code and print exactly the same reports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { relative, resolve } from "node:path";

import type { ExitError, Style } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { Palette } from "./report.js";
import type { Reporter, RunReport } from "./run.js";
import type { CIScript, Runner } from "./types.js";

import { headCommit, isClean, repositoryRoot, sharedGitDirectory } from "./git.js";
import { parseRepositoryName, resolveToken, verifySignoff } from "./github.js";
import { loadScript } from "./load.js";
import { defaultMemoryBudget, parseMemorySize } from "./memory.js";
import {
	actionsReporter,
	appendStepSummary,
	formatSummary,
	jsonReport,
	PLAIN,
	progressReporter,
	textReporter,
} from "./report.js";
import { detectRunner, runScript } from "./run.js";
import { entryDurations, failedLabels, lastRun, recordRun } from "./runs.js";
import { postRecord, readRecord, repositoryOf } from "./signoff.js";
import { scopeSince } from "./since.js";
import { formatWatchCycle, watchProject } from "./watch.js";
import { prepareWorktree } from "./worktree.js";

/** Exit code for a usage error or input that cannot be read. */
const UNREADABLE = 2;

/** Exit code for problems found: a failed run, a missing signoff. */
const PROBLEMS = 1;

/** Milliseconds between `verify --wait` polls. */
const POLL_INTERVAL = 5_000;

/** What every action prints through and runs in. */
export interface ActionIO {
	cwd: string;
	env: Readonly<Record<string, string | undefined>>;
	stdout: (text: string) => void;
	style?: Style;
	signal?: AbortSignal;
	/** Whether stdout is a terminal a person watches, which gets a live line of running steps. */
	interactive?: boolean;
}

/** The filters `run` and `list` share. */
export interface FilterInput {
	only?: readonly string[];
	skip?: readonly string[];
	scope?: readonly string[];
	since?: string;
	runner?: Runner;
}

/** What `run` reads. */
export interface RunInput extends FilterInput {
	push?: boolean;
	signoff?: boolean;
	cache?: boolean;
	concurrency?: number;
	memory?: string;
	worktree?: boolean;
	watch?: boolean;
	remote?: string;
	tokenEnv?: string;
	verbose?: boolean;
	json?: boolean;
	rerunFailed?: boolean;
}

/** The report colors for a stream's style, or none when it takes no ANSI sequences. */
function paletteOf(style: Style | undefined): Palette {
	if (style === undefined || !style.enabled) return PLAIN;
	return {
		green: style.green,
		red: style.red,
		yellow: style.yellow,
		dim: style.dim,
		bold: style.bold,
	};
}

/** Whether the run happens inside a GitHub Actions job, which reads workflow commands. */
function onGitHubActions(env: ActionIO["env"]): boolean {
	return env.GITHUB_ACTIONS === "true";
}

/**
 * How a run prints its steps: nothing with `--json`, groups and annotations on GitHub Actions,
 * a live status line on an interactive terminal, and one plain line per step anywhere else.
 */
function reporterFor(io: ActionIO, input: RunInput, palette: Palette): Reporter | undefined {
	let verbose = input.verbose ?? false;
	if (input.json === true) return undefined;
	if (onGitHubActions(io.env)) return actionsReporter(io.stdout);
	if (io.interactive === true) return progressReporter(io.stdout, palette, verbose);
	return textReporter(io.stdout, palette, verbose);
}

/** A non-empty list, or `null` for a list nobody passed. */
function listOrNull(values: readonly string[] | undefined): readonly string[] | null {
	return values === undefined || values.length === 0 ? null : values;
}

/** The project root a script runs in: the repository's top directory, else the given one. */
async function projectRoot(cwd: string): Promise<string> {
	let root = await repositoryRoot(cwd);
	return isFailure(root) ? cwd : root.data;
}

/** What a run takes from the runs recorded before it. */
interface RunHistory {
	/** Where runs are recorded, or `null` outside a git repository, where nothing is recorded. */
	gitDirectory: string | null;
	durations: ReadonlyMap<string, number>;
	/** The labels `--rerun-failed` runs, or `null` for a run of every step. */
	labels: readonly string[] | null;
	/** How the command ends before running anything, or `null` when the run goes ahead. */
	stop: Result<undefined, ExitError> | null;
}

/**
 * Reads the last recorded run: its entry durations always, so the slowest entries start first,
 * and with `rerunFailed` its failed labels. A re-run with no recorded run exits 2, and one whose
 * last run failed nothing exits 0 without running.
 */
async function runHistory(io: ActionIO, root: string, rerunFailed: boolean): Promise<RunHistory> {
	let gitDirectory = await sharedGitDirectory(root);
	let directory = isFailure(gitDirectory) ? null : gitDirectory.data;
	let last = directory === null ? null : await lastRun(directory);
	let history: RunHistory = {
		gitDirectory: directory,
		durations: last === null ? new Map() : entryDurations(last),
		labels: null,
		stop: null,
	};
	if (!rerunFailed) return history;
	if (last === null) {
		return {
			...history,
			stop: exit(UNREADABLE, "Nothing to re-run: no earlier run is recorded in this repository"),
		};
	}
	let labels = failedLabels(last);
	if (labels.length === 0) {
		io.stdout("Nothing to re-run: the last run had no failed steps\n");
		return { ...history, stop: success() };
	}
	return { ...history, labels };
}

/**
 * Resolves `--scope` and `--since` into the workspace list a run covers. `--since` alone sets
 * the scope from the diff; combined with `--scope` the intersection of both applies. A since
 * fallback (a change outside every workspace) clears the scope so every entry runs, and prints
 * the rule.
 */
async function resolveScope(
	io: ActionIO,
	root: string,
	input: FilterInput,
): Promise<Result<readonly string[] | null, ExitError>> {
	let scoped = listOrNull(input.scope);
	if (input.since === undefined) return success(scoped);
	let since = await scopeSince(root, input.since);
	if (isFailure(since)) return exit(UNREADABLE, since.error.message);
	if (since.data.fallback !== null) {
		io.stdout(
			`--since ${input.since}: ${since.data.fallback} sits outside every workspace; running every entry\n`,
		);
		return success(null);
	}
	if (since.data.scope === null) return success(scoped);
	if (scoped === null) return success(since.data.scope);
	let allowed = new Set(scoped);
	return success(since.data.scope.filter((path) => allowed.has(path)));
}

/** Bytes for `--memory`, or the default share of total RAM when the flag is left out. */
function memoryBudgetOf(input: RunInput): Result<number, ExitError> {
	if (input.memory === undefined) return success(defaultMemoryBudget());
	let parsed = parseMemorySize(input.memory);
	if (isFailure(parsed)) return exit(UNREADABLE, `--memory ${parsed.error.message}`);
	return success(parsed.data);
}

/** Prints one finished run, records it, and answers how the command should exit. */
async function finishRun(
	io: ActionIO,
	input: RunInput,
	report: RunReport,
	history: RunHistory,
	palette: Palette,
): Promise<Result<undefined, ExitError>> {
	let filtered = (input.only?.length ?? 0) > 0 || (input.skip?.length ?? 0) > 0;
	if (filtered && report.steps.every((step) => step.filtered)) {
		return exit(UNREADABLE, "No step matched --only and --skip; `list` prints every step's name");
	}
	let logs = history.gitDirectory === null ? null : await recordRun(history.gitDirectory, report);
	let logsDirectory = logs === null || isFailure(logs) ? null : logs.data;
	if (input.json === true) {
		let json = Object.assign({}, jsonReport(report), { logs: logsDirectory });
		io.stdout(`${JSON.stringify(json, null, 2)}\n`);
	} else {
		io.stdout(formatSummary(report, palette));
		if (logsDirectory !== null) io.stdout(`Logs: ${logsDirectory}\n`);
	}
	let summaryPath = io.env.GITHUB_STEP_SUMMARY;
	if (onGitHubActions(io.env) && summaryPath !== undefined && summaryPath !== "") {
		let appended = await appendStepSummary(summaryPath, report);
		if (isFailure(appended))
			io.stdout(`::warning::Could not write the job summary: ${appended.error.message}\n`);
	}
	if (input.push === true && report.closing?.kind !== "signoff") {
		return exit(
			PROBLEMS,
			"Nothing was pushed: --push pushes only from ci.signoff, and the script did not call it",
		);
	}
	return report.exitCode === 0 ? success() : exit(report.exitCode);
}

/**
 * Runs the script at `script`, printing each step as it finishes and the summary after, or the
 * whole report as JSON. Exits 2 when the script cannot load or a filter matched nothing.
 *
 * @param root - Where the script's commands run; the repository root when left out
 */
export async function runAction(
	io: ActionIO,
	script: string,
	input: RunInput,
	root?: string,
): Promise<Result<undefined, ExitError>> {
	if (input.watch === true && input.push === true) {
		return exit(UNREADABLE, "--watch cannot be combined with --push");
	}
	let directory = root ?? (await projectRoot(io.cwd));
	let budget = memoryBudgetOf(input);
	if (isFailure(budget)) return budget;
	let scope = await resolveScope(io, directory, input);
	if (isFailure(scope)) return scope;
	let worktree = null;
	let runRoot = directory;
	if (input.worktree === true) {
		let prepared = await prepareWorktree(directory);
		if (isFailure(prepared)) return exit(PROBLEMS, prepared.error.message);
		worktree = prepared.data;
		runRoot = worktree.root;
		io.stdout(`Running in worktree ${runRoot}\n`);
	} else if (input.push === true) {
		let clean = await isClean(directory);
		if (!isFailure(clean) && !clean.data) {
			io.stdout(
				"Hint: the tree is dirty; `sdxc ci --worktree --push` signs off from a clean worktree of HEAD\n",
			);
		}
	}
	let scriptPath = scriptIn(directory, runRoot, script, io.cwd);
	let loaded = await loadScript(scriptPath, runRoot);
	if (isFailure(loaded)) {
		if (worktree !== null) await worktree.cleanup();
		return exit(UNREADABLE, loaded.error.message);
	}
	let cleanup = worktree?.cleanup;
	let abortWatch = new AbortController();
	let onAbort = (): void => {
		abortWatch.abort();
	};
	io.signal?.addEventListener("abort", onAbort, { once: true });
	try {
		if (input.watch === true) {
			return await watchRuns(io, loaded.data, input, {
				directory,
				runRoot,
				scope: scope.data,
				budget: budget.data,
				signal: abortWatch.signal,
			});
		}
		let history = await runHistory(io, directory, input.rerunFailed ?? false);
		if (history.stop !== null) return history.stop;
		let palette = paletteOf(io.style);
		let report = await runScript(loaded.data, {
			root: runRoot,
			labels: history.labels,
			durations: history.durations,
			runner: input.runner ?? detectRunner(io.env),
			only: input.only ?? [],
			skip: input.skip ?? [],
			scope: scope.data,
			cache: input.cache ?? true,
			concurrency: input.concurrency,
			memoryBudget: budget.data,
			signoff: input.signoff ?? true,
			push: input.push ?? false,
			remote: input.remote ?? null,
			tokenEnv: input.tokenEnv ?? "GITHUB_TOKEN",
			env: io.env,
			signal: io.signal,
			reporter: reporterFor(io, input, palette),
		});
		return await finishRun(io, input, report, history, palette);
	} finally {
		io.signal?.removeEventListener("abort", onAbort);
		if (cleanup !== undefined) await cleanup();
	}
}

/**
 * The script path to load: when the run is in a worktree, the same relative path inside that
 * worktree, so the script matches HEAD rather than uncommitted edits in the main checkout.
 */
function scriptIn(mainRoot: string, runRoot: string, script: string, cwd: string): string {
	if (mainRoot === runRoot) return script;
	let absolute = resolve(cwd, script);
	let relativePath = relative(mainRoot, absolute);
	if (relativePath.startsWith("..") || relativePath === "") return script;
	return resolve(runRoot, relativePath);
}

/** Options shared by every cycle of a `--watch` run. */
interface WatchRunsOptions {
	directory: string;
	runRoot: string;
	scope: readonly string[] | null;
	budget: number;
	signal: AbortSignal;
}

/**
 * Runs the script once, then again whenever tracked files change. Each cycle aborts when a newer
 * change arrives. Never signs off or pushes; steps without `cache` re-run every cycle.
 */
async function watchRuns(
	io: ActionIO,
	script: CIScript,
	input: RunInput,
	options: WatchRunsOptions,
): Promise<Result<undefined, ExitError>> {
	let history = await runHistory(io, options.directory, false);
	let palette = paletteOf(io.style);
	let cycle = 0;
	let state: { controller: AbortController | null; running: Promise<void> | null } = {
		controller: null,
		running: null,
	};
	let pending = false;

	let startCycle = async (): Promise<void> => {
		if (options.signal.aborted) return;
		cycle += 1;
		let number = cycle;
		state.controller?.abort();
		let controller = new AbortController();
		state.controller = controller;
		let onParent = (): void => {
			controller.abort();
		};
		options.signal.addEventListener("abort", onParent, { once: true });
		let started = Date.now();
		let report = await runScript(script, {
			root: options.runRoot,
			durations: history.durations,
			runner: input.runner ?? detectRunner(io.env),
			only: input.only ?? [],
			skip: input.skip ?? [],
			scope: options.scope,
			cache: input.cache ?? true,
			concurrency: input.concurrency,
			memoryBudget: options.budget,
			signoff: false,
			push: false,
			remote: input.remote ?? null,
			tokenEnv: input.tokenEnv ?? "GITHUB_TOKEN",
			env: io.env,
			signal: controller.signal,
			reporter: reporterFor(io, { ...input, json: false }, palette),
		});
		options.signal.removeEventListener("abort", onParent);
		if (history.gitDirectory !== null) await recordRun(history.gitDirectory, report);
		let aborted = controller.signal.aborted && !options.signal.aborted;
		io.stdout(
			`${formatWatchCycle({
				cycle: number,
				duration: Date.now() - started,
				ran: report.steps.filter(
					(step) => !step.filtered && !step.cached && step.status !== "skipped",
				).length,
				cached: report.steps.filter((step) => step.cached).length,
				failed: report.steps.filter((step) => step.status === "failed").length,
				aborted,
			})}\n`,
		);
		if (!aborted && input.json !== true) io.stdout(formatSummary(report, palette));
	};

	let kick = (): void => {
		pending = true;
		if (state.running !== null) {
			state.controller?.abort();
			return;
		}
		state.running = (async () => {
			while (pending && !options.signal.aborted) {
				pending = false;
				await startCycle();
			}
			state.running = null;
			if (pending && !options.signal.aborted) kick();
		})();
	};

	kick();
	await watchProject(options.directory, {
		onChange: kick,
		signal: options.signal,
	});
	let last = state.running;
	state.controller?.abort();
	if (last !== null) await last;
	return success();
}

/** What `list` reads. */
export interface ListInput extends FilterInput {
	matrix?: string;
	json?: boolean;
}

/**
 * Prints the steps a fully passing run takes, one label per line, or one matrix's entry keys.
 * Every step is stubbed to pass, so branches a failure would take are absent.
 */
export async function listAction(
	io: ActionIO,
	script: string,
	input: ListInput,
	root?: string,
): Promise<Result<undefined, ExitError>> {
	let loaded = await loadScript(script, io.cwd);
	if (isFailure(loaded)) return exit(UNREADABLE, loaded.error.message);
	let directory = root ?? (await projectRoot(io.cwd));
	let scope = await resolveScope(io, directory, input);
	if (isFailure(scope)) return scope;
	let report = await runScript(loaded.data, {
		root: directory,
		runner: input.runner ?? detectRunner(io.env),
		only: input.only ?? [],
		skip: input.skip ?? [],
		scope: scope.data,
		env: io.env,
		dryRun: true,
	});
	if (input.matrix !== undefined) {
		let keys = report.entries
			.filter((entry) => entry.matrix === input.matrix)
			.filter((entry) =>
				report.steps.some((step) => step.entry === entry.address && !step.filtered),
			)
			.map((entry) => entry.key);
		io.stdout(
			input.json === true ? `${JSON.stringify(keys)}\n` : keys.map((key) => `${key}\n`).join(""),
		);
		return success();
	}
	let steps = report.steps.filter((step) => !step.filtered);
	if (input.json === true) {
		let listed = steps.map(({ name, label, entry }) => ({ name, label, entry }));
		io.stdout(`${JSON.stringify(listed, null, 2)}\n`);
	} else {
		io.stdout(steps.map((step) => `${step.label}\n`).join(""));
	}
	return success();
}

/** What `signoff` reads. */
export interface SignoffInput {
	sha?: string;
	remote?: string;
	tokenEnv?: string;
	json?: boolean;
}

/**
 * Posts the signoff an earlier green run recorded for `sha` (HEAD by default). A commit with no
 * record exits 1, so this never marks an untested commit green.
 */
export async function signoffAction(
	io: ActionIO,
	input: SignoffInput,
): Promise<Result<undefined, ExitError>> {
	let root = await repositoryRoot(io.cwd);
	if (isFailure(root)) return exit(UNREADABLE, "Not inside a git repository");
	let gitDirectory = await sharedGitDirectory(root.data);
	if (isFailure(gitDirectory)) return exit(UNREADABLE, "Cannot read the git directory");
	let resolved = input.sha;
	if (resolved === undefined) {
		let head = await headCommit(root.data);
		if (isFailure(head)) return exit(UNREADABLE, "Cannot read HEAD");
		resolved = head.data;
	}
	let record = await readRecord(gitDirectory.data, resolved);
	if (record === null) {
		return exit(
			PROBLEMS,
			`No green run is recorded for ${resolved}; run the CI script on that commit first`,
		);
	}
	let report = await postRecord(
		root.data,
		record,
		{ remote: input.remote ?? null, tokenEnv: input.tokenEnv ?? "GITHUB_TOKEN", env: io.env },
		false,
	);
	if (input.json === true) io.stdout(`${JSON.stringify(report, null, 2)}\n`);
	else if (report.posted) io.stdout(`Signed off ${resolved.slice(0, 10)} as sdxc/ci.\n`);
	else io.stdout(`Not signed off: ${report.reason ?? "unknown reason"}\n`);
	return report.posted ? success() : exit(PROBLEMS);
}

/** What `verify` reads. */
export interface VerifyInput {
	sha: string;
	wait?: string;
	repo?: string;
	remote?: string;
	tokenEnv?: string;
	json?: boolean;
}

/** Milliseconds in `30s`, `2m`, `500ms` or a bare number of seconds; `null` for anything else. */
export function parseDuration(text: string): number | null {
	let match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(text.trim());
	if (match === null) return null;
	let value = Number(match[1]);
	if (match[2] === "ms") return value;
	if (match[2] === "m") return value * 60_000;
	return value * 1000;
}

/** Waits `milliseconds`, or less when `signal` fires. */
function sleep(milliseconds: number, signal: AbortSignal | undefined): Promise<void> {
	return new Promise((resolve) => {
		let timer = setTimeout(resolve, milliseconds);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

/**
 * Exits 0 when a contributor signed `sha` off, 1 when nobody did, and 2 when GitHub could not
 * be reached or the repository not resolved, so an outage never reads as "not signed".
 */
export async function verifyAction(
	io: ActionIO,
	input: VerifyInput,
): Promise<Result<undefined, ExitError>> {
	let wait = input.wait === undefined ? 0 : parseDuration(input.wait);
	if (wait === null)
		return exit(
			UNREADABLE,
			`--wait expects a duration such as 30s, 2m or 500ms, not "${input.wait}"`,
		);
	let repository = input.repo === undefined ? null : parseRepositoryName(input.repo);
	if (input.repo !== undefined && repository === null)
		return exit(UNREADABLE, `--repo expects owner/name, not "${input.repo}"`);
	if (repository === null) {
		let root = await projectRoot(io.cwd);
		let fromRemote = await repositoryOf(root, input.remote ?? "origin");
		if (isFailure(fromRemote)) return exit(UNREADABLE, `Pass --repo: ${fromRemote.error.message}`);
		repository = fromRemote.data;
	}
	let token = await resolveToken(io.env, input.tokenEnv ?? "GITHUB_TOKEN", io.cwd);
	if (isFailure(token)) return exit(UNREADABLE, token.error.message);
	let deadline = Date.now() + wait;
	let verified = await verifySignoff(token.data, repository, input.sha);
	while (
		isFailure(verified) === false &&
		!verified.data.signed &&
		Date.now() < deadline &&
		io.signal?.aborted !== true
	) {
		await sleep(Math.min(POLL_INTERVAL, deadline - Date.now()), io.signal);
		verified = await verifySignoff(token.data, repository, input.sha);
	}
	if (isFailure(verified)) return exit(UNREADABLE, verified.error.message);
	let result = verified.data;
	if (input.json === true) {
		let report = result.signed
			? {
					signed: true,
					by: result.signoff.by,
					at: result.signoff.at,
					description: result.signoff.description,
					reason: null,
				}
			: { signed: false, by: result.by, at: null, description: null, reason: result.reason };
		io.stdout(`${JSON.stringify(report, null, 2)}\n`);
	} else if (result.signed) {
		io.stdout(
			`Signed off by ${result.signoff.by} at ${result.signoff.at}: ${result.signoff.description}\n`,
		);
	} else {
		io.stdout(`Not signed off: ${describeReason(result.reason, result.by)}\n`);
	}
	return result.signed ? success() : exit(PROBLEMS);
}

/** Why a commit is not signed off, as `verify` prints it. */
function describeReason(
	reason: "no-status" | "not-successful" | "not-a-contributor",
	by: string | null,
): string {
	if (reason === "no-status") return "the commit has no sdxc/ci status";
	if (reason === "not-successful") return "the sdxc/ci status is not successful";
	return `${by ?? "its author"} has no write access, so the sdxc/ci status does not count`;
}
