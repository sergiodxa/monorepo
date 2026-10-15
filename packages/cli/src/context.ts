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

	readonly #session: Session;
	readonly #values = new Map<object, unknown>();

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
		return this.#session.exec(command, options);
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

/** A context whatever it parsed, for middleware that runs before every command. */
// oxlint-disable-next-line typescript/no-explicit-any -- arguments and flags vary per command
export type AnyCommandContext = CommandContext<any, any>;
