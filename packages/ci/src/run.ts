/**
 * The run engine: executes a CI script against the `ci` object it builds, recording every step,
 * group and matrix entry with its outcome, applying `--only`, `--skip` and `--scope`, the
 * concurrency limit, halts and caching, then the closing call and the signoff guards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";

import type { Result } from "@sdxc/result";

import { isFailure, isSuccess } from "@sdxc/result";

import type { CommandError, CommandOutput } from "./process.js";
import type { RunRecord, RunStart, SignoffReport } from "./signoff.js";
import type {
	CI,
	CIScript,
	CommandOptions,
	GroupOutcome,
	MatrixOptions,
	ParallelOptions,
	Runner,
	RunStatus,
	StepOptions,
	StepOutcome,
	StepRun,
	StepStatus,
} from "./types.js";
import type { Workspace } from "./workspaces.js";

import {
	cacheDirectory,
	cacheKey,
	hashOutputs,
	pruneCache,
	readCache,
	writeCache,
} from "./cache.js";
import { headCommit, isClean, matchingFiles, repositoryRoot, sharedGitDirectory } from "./git.js";
import { namePattern } from "./glob.js";
import { runCommand } from "./process.js";
import { Semaphore } from "./semaphore.js";
import { checkTree, postRecord, recordOf, writeRecord } from "./signoff.js";
import { isWorkspace, loadWorkspaces, transitiveDependencies } from "./workspaces.js";

/** How a run is configured; every field but `root` has the default the command line gives it. */
export interface RunOptions {
	/** The project root: commands run here, and `package.json` workspaces are read here. */
	root: string;
	runner?: Runner;
	/** Name patterns; a step runs only when it, a group or an entry around it matches one. */
	only?: readonly string[];
	/** Name patterns; a step is left out when it, a group or an entry around it matches one. */
	skip?: readonly string[];
	/** Workspace paths or names a scoped run covers, widened to their dependents. */
	scope?: readonly string[] | null;
	/** `false` runs every step, ignoring stored passes. @default true */
	cache?: boolean;
	/** @default os.availableParallelism() */
	concurrency?: number;
	/** `false` makes `ci.signoff` behave as `ci.success`. @default true */
	signoff?: boolean;
	/** Push the tested commit before signing it off. @default false */
	push?: boolean;
	remote?: string | null;
	/** @default "GITHUB_TOKEN" */
	tokenEnv?: string;
	/** The environment steps inherit and the token is read from. @default process.env */
	env?: Readonly<Record<string, string | undefined>>;
	/** Record every step as passed without running anything, for `list`. @default false */
	dryRun?: boolean;
	/** Stops every running step, the way Ctrl-C does. */
	signal?: AbortSignal;
	/** Receives each finished step and the run's end, to print as it goes. */
	reporter?: Reporter;
	/** Step labels a re-run covers; every other step is left out, as with `--only`. */
	labels?: readonly string[] | null;
	/**
	 * Milliseconds each matrix entry took last time, by address, so the slowest entries start
	 * first and the run ends sooner. Entries without a duration start before every known one.
	 */
	durations?: ReadonlyMap<string, number>;
}

/** Where a run reports as it goes. */
export interface Reporter {
	/** A step took its slots and started running; cached and skipped steps never start. */
	started?(step: StartedStep): void;
	step(record: StepRecord): void;
	error(record: ScriptErrorRecord): void;
	/** The run ended; the reporter releases anything it holds, such as a status line. */
	finished?(report: RunReport): void;
}

/** A step that has started running. */
export interface StartedStep {
	label: string;
	/** `Date.now()` when it started. */
	startedAt: number;
}

/** A finished step, with where it sits in the run. */
export interface StepRecord extends StepOutcome {
	name: string;
	/** The name prefixed with its matrix entry's address, as the summary prints it. */
	label: string;
	/** The names a pattern can match: the step's, each enclosing group's, its entry's address. */
	addresses: string[];
	/** The matrix entry address, `<matrix>/<key>`, or `null` outside a matrix. */
	entry: string | null;
	/** Whether `--only`, `--skip` or `--scope` left it out; filtered steps are never printed. */
	filtered: boolean;
}

/** A matrix entry and how it ended. */
export interface EntryRecord {
	matrix: string;
	key: string;
	address: string;
	status: RunStatus;
}

/** An error a script threw outside any step, failing the run. */
export interface ScriptErrorRecord {
	/** The group or entry it was thrown in, or `null` for the script itself. */
	where: string | null;
	message: string;
}

/** The closing call a script made last. */
export interface Closing {
	kind: "success" | "failure" | "signoff";
	title: string;
	detail: string | null;
}

/** Everything a finished run reports. */
export interface RunReport {
	status: RunStatus;
	exitCode: number;
	runner: Runner;
	/** Whether filters left steps out, so the run cannot sign off. */
	partial: boolean;
	duration: number;
	steps: StepRecord[];
	entries: EntryRecord[];
	errors: ScriptErrorRecord[];
	closing: Closing | null;
	signoff: SignoffReport | null;
	/** Why the run's tree cannot be signed off, or `null` when it can. */
	treeProblem: string | null;
}

/** Where a call sits: the groups around it, innermost last, and its matrix entry. */
interface Scope {
	groups: Group[];
	entry: Entry | null;
}

/** A running `ci.parallel` or `ci.matrix`. */
interface Group {
	name: string;
	failFast: boolean;
	semaphore: Semaphore | null;
	controller: AbortController;
	failed: boolean;
	steps: StepRecord[];
}

/** A running matrix entry. */
interface Entry {
	record: EntryRecord;
	halted: boolean;
	steps: StepRecord[];
	errored: boolean;
	item: unknown;
}

/** One function a group runs, with the scope it runs in and where its errors are reported. */
interface GroupCall {
	scope: Scope;
	call: () => unknown;
	where: string;
	entry: Entry | null;
}

/** The status a set of steps adds up to, `halted` when a halt fired among them. */
function statusOf(steps: readonly StepRecord[], halted: boolean, failed: boolean): RunStatus {
	if (halted) return "halted";
	let counted = steps.filter((step) => !step.filtered);
	if (failed || counted.some((step) => step.status === "failed")) return "failing";
	if (counted.some((step) => step.status === "passed")) return "passing";
	return "pending";
}

/** The key a matrix entry is addressed by when the matrix names no `key` function. */
function defaultKey(item: unknown): string {
	if (typeof item === "object" && item !== null && "name" in item) return String(item.name);
	return String(item);
}

/** What a function step's return value says about its outcome. */
function functionStatus(returned: unknown, anyFailed: boolean): StepStatus {
	if (typeof returned === "object" && returned !== null && "status" in returned) {
		if (returned.status === "failure") return "failed";
		if (returned.status === "success") return "passed";
	}
	return anyFailed ? "failed" : "passed";
}

/** The message a failure `Result` carries, for the step's log. */
function failureMessage(returned: unknown): string | null {
	if (typeof returned !== "object" || returned === null || !("status" in returned)) return null;
	if (returned.status !== "failure" || !("error" in returned)) return null;
	return returned.error instanceof Error ? returned.error.message : String(returned.error);
}

/** The text a thrown value leaves in a log. */
function thrownText(error: unknown): string {
	if (error instanceof Error) return error.stack ?? error.message;
	return String(error);
}

/** Whether the `CI` variable marks this as a CI host. */
export function detectRunner(env: Readonly<Record<string, string | undefined>>): Runner {
	let value = env.CI?.toLowerCase();
	return value === undefined || value === "" || value === "0" || value === "false"
		? "local"
		: "remote";
}

/** One run of a script. */
class Run {
	readonly options: Required<
		Omit<RunOptions, "reporter" | "signal" | "remote" | "scope" | "labels">
	> & {
		labels: readonly string[] | null;
		reporter: Reporter | null;
		signal: AbortSignal | null;
		remote: string | null;
		scope: readonly string[] | null;
	};
	readonly storage = new AsyncLocalStorage<Scope>();
	readonly global: Semaphore;
	readonly steps: StepRecord[] = [];
	readonly entries: EntryRecord[] = [];
	readonly errors: ScriptErrorRecord[] = [];
	readonly onlyPatterns: RegExp[];
	readonly skipPatterns: RegExp[];
	readonly startedAt = Date.now();
	halted = false;
	scriptFailed = false;
	closing: Closing | null = null;
	signoffReport: SignoffReport | null = null;
	recordWritten = false;
	start: RunStart | null = null;
	workspaces: Promise<Workspace[]> | null = null;
	gitDirectory: string | null = null;

	/** Fills every option the caller left out with the command line's default. */
	constructor(options: RunOptions) {
		let env = options.env ?? process.env;
		this.options = {
			root: options.root,
			runner: options.runner ?? detectRunner(env),
			only: options.only ?? [],
			skip: options.skip ?? [],
			scope: options.scope ?? null,
			cache: options.cache ?? true,
			concurrency: options.concurrency ?? availableParallelism(),
			signoff: options.signoff ?? true,
			push: options.push ?? false,
			remote: options.remote ?? null,
			tokenEnv: options.tokenEnv ?? "GITHUB_TOKEN",
			env,
			dryRun: options.dryRun ?? false,
			signal: options.signal ?? null,
			reporter: options.reporter ?? null,
			labels: options.labels ?? null,
			durations: options.durations ?? new Map(),
		};
		this.global = new Semaphore(this.options.concurrency);
		this.onlyPatterns = this.options.only.map(namePattern);
		this.skipPatterns = this.options.skip.map(namePattern);
	}

	/** Whether filters left steps out; a partial run never signs off. */
	get partial(): boolean {
		return (
			this.onlyPatterns.length > 0 ||
			this.skipPatterns.length > 0 ||
			this.options.scope !== null ||
			this.options.labels !== null
		);
	}

	/** The run's status so far, counting script errors and `ci.failure` as failures. */
	get status(): RunStatus {
		return statusOf(this.steps, this.halted, this.scriptFailed || this.errors.length > 0);
	}

	/** The `ci` object the script receives. */
	api(): CI {
		let status = (): RunStatus => this.status;
		let { runner, scope, root } = this.options;
		return {
			step: (name, step, options) => this.step(name, step, options ?? {}),
			parallel: (name, functions, options) => this.parallel(name, functions, options ?? {}),
			matrix: (name, items, fn, options) => this.matrix(name, items, fn, options ?? {}),
			workspaces: () => this.loadWorkspaces(),
			files: (glob) => this.files(glob),
			success: (title, detail) => this.close("success", title, detail),
			failure: (title, detail) => this.close("failure", title, detail),
			signoff: (title, detail) => this.signoff(title, detail),
			get status() {
				return status();
			},
			runner,
			scope,
			root,
			cores: availableParallelism(),
		};
	}

	/** The project's workspaces, read once per run. */
	loadWorkspaces(): Promise<Workspace[]> {
		this.workspaces ??= loadWorkspaces(this.options.root).then((loaded) =>
			isSuccess(loaded) ? loaded.data : [],
		);
		return this.workspaces;
	}

	/** The tracked files matching `glob`, relative to the project root, in path order. */
	async files(glob: string): Promise<string[]> {
		let found = await matchingFiles(this.options.root, glob);
		return isSuccess(found) ? found.data : [];
	}

	/** Whether the filters, and a re-run's labels, let a step with these addresses run. */
	selected(addresses: readonly string[], label: string): boolean {
		if (this.options.labels !== null && !this.options.labels.includes(label)) return false;
		let matches = (patterns: readonly RegExp[]): boolean =>
			patterns.some((pattern) => addresses.some((address) => pattern.test(address)));
		if (this.onlyPatterns.length > 0 && !matches(this.onlyPatterns)) return false;
		return !matches(this.skipPatterns);
	}

	/** Records a finished step everywhere it belongs, then reports it. */
	finish(record: StepRecord, scope: Scope): StepRecord {
		this.steps.push(record);
		for (let group of scope.groups) group.steps.push(record);
		scope.entry?.steps.push(record);
		if (!record.filtered) this.options.reporter?.step(record);
		return record;
	}

	/**
	 * Runs one step under the filters, halts, fail-fast groups and concurrency limits around
	 * it; only a selected, unstopped step takes a slot.
	 */
	async step(name: string, run: StepRun, options: StepOptions): Promise<StepOutcome> {
		let scope = this.storage.getStore() ?? { groups: [], entry: null };
		let entryAddress = scope.entry?.record.address ?? null;
		let addresses = [
			name,
			...scope.groups.map((group) => group.name),
			...(entryAddress === null ? [] : [entryAddress]),
		];
		let base = {
			name,
			label: entryAddress === null ? name : `${entryAddress} › ${name}`,
			addresses,
			entry: entryAddress,
			cached: false,
			duration: 0,
			output: "",
			attempts: 1,
			flaky: false,
		};
		if (!this.selected(addresses, base.label)) {
			return this.finish({ ...base, status: "skipped", filtered: true }, scope);
		}
		let stopped =
			this.halted ||
			scope.entry?.halted === true ||
			scope.groups.some((group) => group.failed) ||
			this.options.signal?.aborted === true;
		if (stopped) return this.finish({ ...base, status: "skipped", filtered: false }, scope);
		if (this.options.dryRun)
			return this.finish({ ...base, status: "passed", filtered: false }, scope);

		let releases: Array<() => void> = [];
		for (let group of scope.groups) {
			if (group.semaphore !== null) {
				releases.push(await group.semaphore.acquire(options.weight ?? 1));
			}
		}
		releases.push(await this.global.acquire(options.weight ?? 1));
		let record = await this.execute(base, run, options, scope).finally(() => {
			for (let release of releases.reverse()) release();
		});
		this.finish(record, scope);
		if (record.status === "failed") this.afterFailure(options, scope);
		return record;
	}

	/** Applies a failed step's halt and the fail-fast of every group around it. */
	afterFailure(options: StepOptions, scope: Scope): void {
		if (options.halt === true) {
			if (scope.entry === null) this.halted = true;
			else scope.entry.halted = true;
		}
		for (let group of scope.groups) {
			if (group.failFast) {
				group.failed = true;
				group.controller.abort();
			}
		}
	}

	/** Runs a selected step, from the cache when its inputs are unchanged. */
	async execute(
		base: Omit<StepRecord, "status" | "filtered">,
		run: StepRun,
		options: StepOptions,
		scope: Scope,
	): Promise<StepRecord> {
		let key =
			options.cache === undefined || options.cache === false
				? null
				: await this.keyOf(base.label, run, options, scope);
		if (key !== null && this.options.cache && this.gitDirectory !== null) {
			let hit = await readCache(this.options.root, cacheDirectory(this.gitDirectory), key);
			if (hit !== null) {
				return {
					...base,
					status: "passed",
					cached: true,
					duration: hit.duration,
					output: hit.output,
					filtered: false,
				};
			}
		}
		let started = Date.now();
		this.options.reporter?.started?.({ label: base.label, startedAt: started });
		let { status, output, attempts } = await this.attempt(run, options, scope);
		let record: StepRecord = {
			...base,
			status,
			duration: Date.now() - started,
			output,
			attempts,
			flaky: status === "passed" && attempts > 1,
			filtered: false,
		};
		if (status === "passed" && key !== null && this.gitDirectory !== null) {
			let outputs = typeof options.cache === "object" ? (options.cache.outputs ?? []) : [];
			await writeCache(cacheDirectory(this.gitDirectory), key, {
				duration: record.duration,
				output: record.output,
				outputs: await hashOutputs(this.options.root, outputs),
			});
		}
		return record;
	}

	/**
	 * Runs a step, and again up to `retry` more times while it fails, joining every attempt's
	 * log. An attempt stopped by its signal (timeout, fail-fast, Ctrl-C) ends the retries.
	 */
	async attempt(
		run: StepRun,
		options: StepOptions,
		scope: Scope,
	): Promise<{ status: StepStatus; output: string; attempts: number }> {
		let retries = Math.max(0, Math.floor(options.retry ?? 0));
		let output = "";
		let attempts = 0;
		let status: StepStatus = "failed";
		while (attempts <= retries) {
			attempts += 1;
			let signals = scope.groups.map((group) => group.controller.signal);
			if (this.options.signal !== null) signals.push(this.options.signal);
			if (options.timeout !== undefined) signals.push(AbortSignal.timeout(options.timeout));
			let signal = AbortSignal.any(signals);
			let performed = await this.perform(run, options, signal);
			let timedOut =
				signal.aborted &&
				signal.reason instanceof DOMException &&
				signal.reason.name === "TimeoutError";
			let heading = attempts > 1 ? `--- attempt ${attempts} ---\n` : "";
			let note = timedOut ? `Timed out after ${options.timeout}ms\n` : "";
			output += `${heading}${performed.output}${note}`;
			status = performed.status;
			if (status === "passed" || signal.aborted) break;
		}
		return { status, output, attempts };
	}

	/** Runs a command or function step and gathers its log. */
	async perform(
		run: StepRun,
		options: CommandOptions,
		signal: AbortSignal,
	): Promise<{ status: StepStatus; output: string }> {
		let output = "";
		let anyFailed = false;
		let runOne = async (
			command: string | readonly string[],
			commandOptions?: CommandOptions,
		): Promise<Result<CommandOutput, CommandError>> => {
			let merged = {
				...options,
				...commandOptions,
				env: { ...options.env, ...commandOptions?.env },
			};
			let ran = await runCommand(command, {
				cwd: resolve(this.options.root, merged.cwd ?? "."),
				env: { ...this.options.env, ...merged.env },
				signal,
				onOutput: (text) => {
					output += text;
				},
			});
			if (isFailure(ran)) {
				anyFailed = true;
				if (ran.error.code === null && !signal.aborted) output += `${ran.error.message}\n`;
			}
			return ran;
		};
		if (typeof run !== "function") {
			let ran = await runOne(run);
			return { status: isFailure(ran) ? "failed" : "passed", output };
		}
		let handle = {
			run: runOne,
			log: (...values: unknown[]) => {
				output += `${values.map((value) => (typeof value === "string" ? value : JSON.stringify(value))).join(" ")}\n`;
			},
			signal,
		};
		let returned: unknown;
		try {
			returned = await run(handle);
		} catch (error) {
			return { status: "failed", output: `${output}${thrownText(error)}\n` };
		}
		let message = failureMessage(returned);
		return {
			status: functionStatus(returned, anyFailed),
			output: message === null ? output : `${output}${message}\n`,
		};
	}

	/** The cache key for a step, or `null` when the inputs cannot be read. */
	async keyOf(
		label: string,
		run: StepRun,
		options: StepOptions,
		scope: Scope,
	): Promise<string | null> {
		let cache = typeof options.cache === "object" ? options.cache : {};
		let inputs = cache.inputs ?? (await this.defaultInputs(scope));
		let identity = JSON.stringify([
			label,
			typeof run === "function" ? run.toString() : run,
			options.cwd ?? null,
			options.env ?? null,
		]);
		let key = await cacheKey(
			this.options.root,
			{ identity, inputs, env: cache.env ?? [] },
			{ ...this.options.env, ...options.env },
		);
		return isSuccess(key) ? key.data : null;
	}

	/**
	 * Inputs for `cache: true`: inside a workspace entry, that workspace, the ones it depends on,
	 * and the files at the root; elsewhere, every file.
	 */
	async defaultInputs(scope: Scope): Promise<string[]> {
		let item = scope.entry?.item;
		return isWorkspace(item) ? item.inputs : ["**"];
	}

	/**
	 * Runs a group's calls concurrently, recording anything one throws outside a step as a script
	 * error; answers whether any call threw.
	 */
	async inGroup(calls: readonly GroupCall[]): Promise<boolean> {
		let threw = await Promise.all(
			calls.map(async ({ scope, call, where, entry }) => {
				try {
					await this.storage.run(scope, call);
					return false;
				} catch (error) {
					this.scriptError(where, error);
					if (entry !== null) entry.errored = true;
					return true;
				}
			}),
		);
		return threw.includes(true);
	}

	/** Records and reports an error a script threw outside any step. */
	scriptError(where: string | null, error: unknown): void {
		let record = { where, message: thrownText(error) };
		this.errors.push(record);
		this.options.reporter?.error(record);
	}

	/** A new group inside the current scope. */
	newGroup(name: string, options: ParallelOptions): { group: Group; outer: Scope } {
		let outer = this.storage.getStore() ?? { groups: [], entry: null };
		let group: Group = {
			name,
			failFast: options.failFast ?? false,
			semaphore: options.concurrency === undefined ? null : new Semaphore(options.concurrency),
			controller: new AbortController(),
			failed: false,
			steps: [],
		};
		return { group, outer };
	}

	/** Runs each function concurrently as one group; its status adds up the steps inside it. */
	async parallel(
		name: string,
		functions: ReadonlyArray<() => unknown>,
		options: ParallelOptions,
	): Promise<GroupOutcome> {
		let { group, outer } = this.newGroup(name, options);
		let scope: Scope = { groups: [...outer.groups, group], entry: outer.entry };
		let threw = await this.inGroup(
			functions.map((call) => ({ scope, call, where: name, entry: null })),
		);
		return { status: statusOf(group.steps, false, threw) };
	}

	/** Runs `fn` once per in-scope item, each call an entry with its own status and halt. */
	async matrix<Item>(
		name: string,
		items: readonly Item[],
		fn: (item: Item) => unknown,
		options: MatrixOptions<Item>,
	): Promise<GroupOutcome> {
		let { group, outer } = this.newGroup(name, options);
		let inScope = await this.scopeFilter();
		let calls: GroupCall[] = [];
		let entries: Entry[] = [];
		for (let item of items) {
			let key = options.key?.(item) ?? defaultKey(item);
			if (!inScope(item, key)) continue;
			let address = `${name}/${key}`;
			let entry: Entry = {
				record: { matrix: name, key, address, status: "pending" },
				halted: false,
				steps: [],
				errored: false,
				item,
			};
			entries.push(entry);
			this.entries.push(entry.record);
			calls.push({
				scope: { groups: [...outer.groups, group], entry },
				call: () => fn(item),
				where: address,
				entry,
			});
		}
		let threw = await this.inGroup(this.slowestFirst(calls));
		for (let entry of entries)
			entry.record.status = statusOf(entry.steps, entry.halted, entry.errored);
		return { status: statusOf(group.steps, false, threw) };
	}

	/**
	 * Entries ordered by how long they took last time, slowest first, so the longest ones never
	 * start last; entries with no recorded duration go first, and ties keep the script's order.
	 */
	slowestFirst(calls: readonly GroupCall[]): GroupCall[] {
		let durationOf = (call: GroupCall): number =>
			this.options.durations.get(call.where) ?? Number.POSITIVE_INFINITY;
		return calls
			.map((call, index) => ({ call, index }))
			.sort((a, b) => durationOf(b.call) - durationOf(a.call) || a.index - b.index)
			.map(({ call }) => call);
	}

	/**
	 * Whether a matrix item is in `--scope`: its key, name or path is scoped, or it is a
	 * workspace depending on a scoped one. Every item is in a full run's scope.
	 */
	async scopeFilter(): Promise<(item: unknown, key: string) => boolean> {
		let scope = this.options.scope;
		if (scope === null) return () => true;
		let workspaces = await this.loadWorkspaces();
		let scoped = new Set<string>();
		for (let value of scope) {
			let clean = value.replace(/\/$/, "");
			let match = workspaces.find(
				(workspace) => workspace.path === clean || workspace.name === clean,
			);
			scoped.add(match?.name ?? clean);
		}
		return (item, key) => {
			if (scoped.has(key)) return true;
			if (!isWorkspace(item)) {
				let path =
					typeof item === "object" && item !== null && "path" in item ? String(item.path) : null;
				return path !== null && scope.includes(path);
			}
			if (scoped.has(item.name)) return true;
			return transitiveDependencies(item.name, workspaces).some((name) => scoped.has(name));
		};
	}

	/**
	 * Records the closing call. `failure` fails the run; `success` and `signoff` on a run that
	 * is not passing are script errors, so a script can never close a failed run as green.
	 */
	close(kind: Closing["kind"], title: string, detail: string | undefined): void {
		this.closing = { kind, title, detail: detail ?? null };
		if (kind === "failure") {
			this.scriptFailed = true;
			return;
		}
		if (this.status !== "passing" && !this.options.dryRun) {
			this.scriptFailed = true;
			this.errors.push({
				where: null,
				message: `ci.${kind} was called while the run is ${this.status}`,
			});
		}
	}

	/** Closes the run and, on a local run that passes every guard, records and posts the signoff. */
	async signoff(title: string | undefined, detail: string | undefined): Promise<void> {
		this.close("signoff", title ?? "Signed off.", detail);
		if (this.scriptFailed || this.options.dryRun) return;
		if (this.options.runner === "remote") {
			this.signoffReport = {
				posted: false,
				pushed: false,
				sha: null,
				reason: "remote runs never sign off",
			};
			return;
		}
		if (!this.options.signoff) {
			this.signoffReport = { posted: false, pushed: false, sha: null, reason: "--no-signoff" };
			return;
		}
		let problem = await this.signoffProblem();
		if (problem !== null || this.start === null) {
			this.signoffReport = {
				posted: false,
				pushed: false,
				sha: this.start?.head ?? null,
				reason: problem,
			};
			return;
		}
		let record = this.newRecord(this.start);
		await writeRecord(this.start, record);
		this.recordWritten = true;
		this.signoffReport = await postRecord(
			this.start.root,
			record,
			{ remote: this.options.remote, tokenEnv: this.options.tokenEnv, env: this.options.env },
			this.options.push,
		);
	}

	/** Why this run cannot be signed off, or `null` when every guard holds. */
	async signoffProblem(): Promise<string | null> {
		if (this.start === null) return "the project is not a git repository";
		if (this.partial) return "--only, --skip or --scope left steps out";
		let tree = await checkTree(this.start);
		return isFailure(tree) ? tree.error.message : null;
	}

	/** Reads what the guards compare against at the end: HEAD, the tree, the shared git directory. */
	async begin(): Promise<void> {
		let root = await repositoryRoot(this.options.root);
		if (isFailure(root)) return;
		let gitDirectory = await sharedGitDirectory(root.data);
		let head = await headCommit(root.data);
		let clean = await isClean(root.data);
		if (isFailure(gitDirectory) || isFailure(head) || isFailure(clean)) return;
		this.gitDirectory = gitDirectory.data;
		this.start = {
			root: root.data,
			gitDirectory: gitDirectory.data,
			head: head.data,
			clean: clean.data,
		};
	}

	/** Leaves a green run's record, when the run passed in full on a tree that stayed clean. */
	async end(): Promise<void> {
		if (this.options.dryRun || this.recordWritten || this.start === null) return;
		if (this.status !== "passing" || this.scriptFailed || this.options.runner === "remote") return;
		if ((await this.signoffProblem()) !== null) return;
		await writeRecord(this.start, this.newRecord(this.start));
	}

	/** The record this run leaves for the commit it tested. */
	newRecord(start: RunStart): RunRecord {
		return recordOf(
			start,
			Date.now() - this.startedAt,
			this.steps.filter((step) => !step.filtered).length,
		);
	}

	/** 0 for a passing run closed without error and, with `--push`, signed off; 1 otherwise. */
	exitCode(): number {
		if (this.status !== "passing" && !this.options.dryRun) return 1;
		if (this.scriptFailed) return 1;
		if (this.options.push && this.signoffReport?.posted !== true) return 1;
		return 0;
	}

	/** The finished run as a plain object for printing and `--json`. */
	report(treeProblem: string | null): RunReport {
		return {
			status: this.status,
			exitCode: this.exitCode(),
			runner: this.options.runner,
			partial: this.partial,
			duration: Date.now() - this.startedAt,
			steps: this.steps,
			entries: this.entries,
			errors: this.errors,
			closing: this.closing,
			signoff: this.signoffReport,
			treeProblem,
		};
	}
}

/**
 * Runs `script` and resolves to its report; it never rejects, since anything the script throws
 * outside a step is recorded as a script error that fails the run.
 */
export async function runScript(script: CIScript, options: RunOptions): Promise<RunReport> {
	let run = new Run(options);
	await run.begin();
	try {
		await run.storage.run({ groups: [], entry: null }, () => script(run.api()));
	} catch (error) {
		run.scriptError(null, error);
	}
	await run.end();
	if (run.gitDirectory !== null && options.dryRun !== true) {
		await pruneCache(cacheDirectory(run.gitDirectory));
	}
	let treeProblem = options.dryRun === true ? null : await run.signoffProblem();
	let report = run.report(treeProblem);
	run.options.reporter?.finished?.(report);
	return report;
}
