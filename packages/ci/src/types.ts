/**
 * The shapes a CI script works with: the `ci` object it receives, the handle a function step
 * receives, every option a step, group or matrix takes, and the outcomes they resolve to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import type { CommandError, CommandOutput } from "./process.js";
import type { Workspace } from "./workspaces.js";

/**
 * Where a run happens: `remote` on a CI host (the `CI` environment variable is set), `local`
 * everywhere else. Remote runs never sign off; the host's own checks are the green mark there.
 */
export type Runner = "local" | "remote";

/**
 * A run's status so far. `pending` until a step finishes, `passing` while every finished step
 * passed, `failing` once one failed, and `halted` once a `halt` step failed, after which every
 * later step is skipped. It never returns to `passing`.
 */
export type RunStatus = "pending" | "passing" | "failing" | "halted";

/** A finished step's outcome; final, unlike a run's status. */
export type StepStatus = "passed" | "failed" | "skipped";

/** What a step runs: a shell command line, an argv run without a shell, or a function. */
export type StepRun = string | readonly string[] | StepFunction;

/**
 * A function step. Its outcome is the `Result` it returns; returning nothing fails the step when
 * any `step.run` inside it failed. A thrown error fails the step and is reported under it.
 */
export type StepFunction = (step: StepHandle) => unknown;

/** What a function step uses to run commands and write to its own log. */
export interface StepHandle {
	/**
	 * Runs a command line (through the shell) or an argv (without one) into the step's log.
	 * The command stops when `signal` fires.
	 */
	run(
		command: string | readonly string[],
		options?: CommandOptions,
	): Promise<Result<CommandOutput, CommandError>>;
	/** Appends a line to the step's log. */
	log(...values: unknown[]): void;
	/** Fires on Ctrl-C, on the step's `timeout`, and when a `failFast` sibling fails. */
	readonly signal: AbortSignal;
}

/** Where and with what a command runs. */
export interface CommandOptions {
	/** Directory relative to the project root. @default the project root */
	cwd?: string;
	/** Variables added to the environment the run inherited. */
	env?: Readonly<Record<string, string>>;
}

/** What a step's result is keyed on when it is cached. */
export interface CacheOptions {
	/**
	 * Git pathspec globs whose file contents form the key. Inside a matrix entry over
	 * `ci.workspaces()` the default is the entry's workspace, the workspaces it depends on and
	 * the files at the project root; elsewhere it is every file in the repository.
	 */
	inputs?: readonly string[];
	/** Environment variables whose values form the key. */
	env?: readonly string[];
	/** Paths the step writes; a hit counts only while they still hold what the step left. */
	outputs?: readonly string[];
}

/** How one step runs. */
export interface StepOptions extends CommandOptions {
	/** A failure halts the run, or only the matrix entry the step belongs to. @default false */
	halt?: boolean;
	/** Skip the step when a previous run passed it with the same inputs. @default false */
	cache?: boolean | CacheOptions;
	/** Milliseconds after which the step's signal fires and the step fails. */
	timeout?: number;
	/**
	 * Runs a failed step again, up to this many more times; a step that passes on a later
	 * attempt passes, marked flaky in the report. A step stopped by its signal is never retried.
	 * @default 0
	 */
	retry?: number;
	/**
	 * Concurrency slots the step holds while it runs, so a heavy step (a test suite that spreads
	 * over every core) leaves room for fewer steps beside it.
	 * @default 1
	 */
	weight?: number;
}

/** What a step resolved to. */
export interface StepOutcome {
	status: StepStatus;
	/** Whether a previous run's pass was reused. */
	cached: boolean;
	/** Milliseconds the step took, or took when it was cached. */
	duration: number;
	output: string;
	/** How many times the step ran: 1, or more when `retry` ran it again. */
	attempts: number;
	/** Whether it failed at first and passed on a retry. */
	flaky: boolean;
}

/** How a group of concurrent functions runs. */
export interface ParallelOptions {
	/** A failure aborts the group's running steps and skips its later ones. @default false */
	failFast?: boolean;
	/** Most steps of this group running at once. @default os.availableParallelism() */
	concurrency?: number;
}

/** How a matrix runs, and how its entries are addressed. */
export interface MatrixOptions<Item> extends ParallelOptions {
	/**
	 * The entry's key, addressed as `<matrix>/<key>` by `--only`, `--skip` and a CI host's
	 * matrix. @default the item's `name`, or the item itself when it is not an object
	 */
	key?: (item: Item) => string;
}

/** What a group or matrix resolved to. */
export interface GroupOutcome {
	status: RunStatus;
}

/** The object a CI script receives. */
export interface CI {
	/**
	 * Runs one step and resolves to its outcome; a step after a halt, or left out by
	 * `--only`/`--skip`, resolves to `skipped` without running.
	 */
	step(name: string, run: StepRun, options?: StepOptions): Promise<StepOutcome>;
	/** Runs each function concurrently as one named group. */
	parallel(
		name: string,
		functions: ReadonlyArray<() => unknown>,
		options?: ParallelOptions,
	): Promise<GroupOutcome>;
	/** Runs `fn` once per item, concurrently, each call a matrix entry with its own status. */
	matrix<Item>(
		name: string,
		items: readonly Item[],
		fn: (item: Item) => unknown,
		options?: MatrixOptions<Item>,
	): Promise<GroupOutcome>;
	/** The project's workspaces, from the `workspaces` field of its `package.json`. */
	workspaces(): Promise<Workspace[]>;
	/**
	 * The tracked files matching a glob, relative to `root`, in path order, so a script finds
	 * files to act on without reading the disk itself.
	 *
	 * @example await ci.files("**\/.env.example")
	 */
	files(glob: string): Promise<string[]>;
	/** Prints a green closing message; a run that is not `passing` makes it a script error. */
	success(title: string, detail?: string): void;
	/** Prints a red closing message and fails the run, even when every step passed. */
	failure(title: string, detail?: string): void;
	/**
	 * Prints a green closing message and signs the commit off with a GitHub commit status when
	 * the run passed, ran in full, and tested exactly the committed tree.
	 */
	signoff(title?: string, detail?: string): Promise<void>;
	readonly status: RunStatus;
	readonly runner: Runner;
	/** The workspace paths a scoped run covers; `null` on a full run. */
	readonly scope: readonly string[] | null;
	/** The project root, where every step runs unless given a `cwd`, as an absolute path. */
	readonly root: string;
	/** The cores this machine can run on at once, to size a group's `concurrency`. */
	readonly cores: number;
}

/** A CI script: the default export of the file a run loads. */
export type CIScript = (ci: CI) => unknown;
