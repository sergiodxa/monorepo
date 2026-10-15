/**
 * The context a command's middleware and handler receive: its parsed arguments and flags, the
 * process it runs in (working directory, environment, output, prompts, tasks, child processes)
 * and the values middleware published, readable by key or as installed properties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ContextValue } from "remix/router";

import type { CancelledError } from "./errors.js";
import type { ExecError, ExecOptions, ExecOutput } from "./exec.js";
import type { Input } from "./keys.js";
import type { Prompter } from "./prompt.js";
import type { Session } from "./session.js";
import type { Env, Style } from "./style.js";
import type { RunTask } from "./task.js";

/** Everything a context is built from. */
export interface CommandContextInit<Arguments, Flags> {
	path: readonly string[];
	arguments: Arguments;
	flags: Flags;
	session: Session;
	prompt: Prompter;
}

/**
 * One command's run. A test builds one through `invoke()` from `@sdxc/cli/test`; a middleware
 * publishes services with `set()`, which a handler reads as `ctx.<property>`.
 *
 * @example ctx.set(Database, connect(ctx.env.DATABASE_URL), { property: "db" });
 */
export class CommandContext<Arguments = unknown, Flags = unknown> {
	/** The command's names after the program, `["ui", "add"]` for `sdxc ui add`. */
	readonly path: readonly string[];
	/** The positional arguments, parsed, prompted for, or defaulted. */
	readonly arguments: Arguments;
	/** The flags, parsed, prompted for, or defaulted. */
	readonly flags: Flags;
	readonly cwd: string;
	readonly env: Env;
	/** Styling for stdout; `style.stderr` styles stderr, each off for a stream that is not a terminal. */
	readonly style: Style & { readonly stderr: Style };
	/** Aborts on Ctrl+C. */
	readonly signal: AbortSignal;
	/**
	 * Questions a handler asks itself. Each takes a `default`, which answers without a
	 * terminal, so the command stays runnable in CI.
	 */
	readonly prompt: Prompter;
	/**
	 * Runs async work under a spinner, answering a `Result`; the label is optional.
	 *
	 * @example let posts = await ctx.task("Fetching posts", (task) => fetch(url, { signal: task.signal }));
	 */
	readonly task: RunTask;

	/**
	 * What the command was piped. `stdin.isTTY` is true at a terminal, where `text()` would wait
	 * for the user to end input, so a handler reads it only when `isTTY` is false.
	 *
	 * @example let sql = ctx.flags.execute ?? (ctx.stdin.isTTY ? undefined : await ctx.stdin.text());
	 */
	readonly stdin: Stdin;

	readonly #session: Session;
	readonly #values = new Map<object, unknown>();
	#execEnv: Env = {};

	/** @param init - The parsed command and the run it belongs to */
	constructor(init: CommandContextInit<Arguments, Flags>) {
		this.path = init.path;
		this.arguments = init.arguments;
		this.flags = init.flags;
		this.cwd = init.session.cwd;
		this.env = init.session.env;
		this.style = init.session.style;
		this.signal = init.session.signal;
		this.prompt = init.prompt;
		this.task = init.session.tasks.task;
		this.stdin = createStdin(init.session.stdin);
		this.#session = init.session;
	}

	/** Writes to stdout, above any running task. */
	readonly stdout = (text: string): void => {
		this.#session.screen.write(this.#session.stdout, text);
	};

	/** Writes to stderr, above any running task. */
	readonly stderr = (text: string): void => {
		this.#session.screen.write(this.#session.stderr, text);
	};

	/**
	 * Runs a program with no shell, answering its exit code and output, or an `ExecError` when
	 * it fails to start or exits non-zero. `"inherit"` and `"stderr"` output pauses any spinner
	 * until the child exits.
	 *
	 * @param command - The program and its arguments, passed through exactly
	 * @example let status = await ctx.exec(["git", "status", "--short"], { stdio: "collect" });
	 */
	exec(
		command: readonly string[],
		options?: ExecOptions,
	): Promise<Result<ExecOutput, ExecError | CancelledError>> {
		return this.#session.exec(command, {
			...options,
			env: { ...this.#execEnv, ...options?.env },
		});
	}

	/**
	 * Adds variables every child `exec` starts with, over the run's `env` and under a call's own
	 * `options.env`, so a middleware hands children what it knows (a trace parent) and a caller
	 * still overrides it. An `undefined` value removes the variable from children.
	 *
	 * @param variables - Merged over what earlier calls added
	 * @example ctx.setExecEnv({ TRACEPARENT: toTraceParent(trace) });
	 */
	setExecEnv(variables: Env): void {
		this.#execEnv = { ...this.#execEnv, ...variables };
	}

	/**
	 * Reads a value some middleware published.
	 *
	 * @param key - The context key to read
	 * @returns Its value, the key's default, or `undefined`
	 */
	get<Key extends object>(key: Key): ContextValue<Key> | undefined {
		if (this.#values.has(key)) return this.#values.get(key) as ContextValue<Key>;
		return (key as { defaultValue?: ContextValue<Key> }).defaultValue;
	}

	/**
	 * Reads a value an earlier middleware must have published. A middleware sees the bare
	 * context, without the properties earlier ones installed, so this is how it reads them
	 * without an `undefined` it has no answer for; a missing value fails the run with exit 1.
	 *
	 * @param key - The context key to read
	 * @throws Error When nothing published a value for the key
	 * @example let db = ctx.require(Database);
	 */
	require<Key extends object>(key: Key): NonNullable<ContextValue<Key>> {
		let value = this.get(key);
		if (value === undefined || value === null) {
			throw new Error(`${this.path.join(" ")} read a context key that no middleware published`);
		}
		return value as NonNullable<ContextValue<Key>>;
	}

	/**
	 * Whether a value has been published for a key.
	 *
	 * @param key - The context key to check
	 */
	has(key: object): boolean {
		return this.#values.has(key);
	}

	/**
	 * Publishes a value for a key, optionally installing it as a read-only property so handlers
	 * read `ctx.db` rather than `ctx.get(Database)`.
	 *
	 * @param key - The context key to write
	 * @param value - The value to publish
	 * @param options - The property name to install it under
	 */
	set<Key extends object>(
		key: Key,
		value: ContextValue<Key>,
		options?: { property: string },
	): void {
		this.#values.set(key, value);
		if (options === undefined) return;
		Object.defineProperty(this, options.property, {
			value,
			configurable: true,
			enumerable: true,
			writable: false,
		});
	}
}

/** The run's standard input. */
export interface Stdin {
	/** Whether stdin is a terminal, as opposed to a pipe or a file. */
	readonly isTTY: boolean;
	/** Everything piped in, read once to its end; later calls answer the same text. */
	text(): Promise<string>;
}

/** A reader over `input` that reads it to the end at most once. */
function createStdin(input: Input): Stdin {
	let reading: Promise<string> | undefined;
	return {
		isTTY: input.isTTY === true,
		text() {
			reading ??= new Promise((resolve, reject) => {
				let chunks: string[] = [];
				input.on("data", (chunk: string | Uint8Array) => {
					chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
				});
				input.once("end", () => resolve(chunks.join("")));
				input.once("error", reject);
				input.resume();
			});
			return reading;
		},
	};
}

/** A context whatever it parsed, for middleware that runs before every command. */
// oxlint-disable-next-line typescript/no-explicit-any -- arguments and flags vary per command
export type AnyCommandContext = CommandContext<any, any>;
