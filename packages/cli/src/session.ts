/**
 * One run's process context: its working directory, environment and streams, whether it may
 * ask questions, the terminal owner tasks and prompts draw through, and the signal Ctrl+C
 * aborts. Built from `cli.run`'s options, each defaulting to the process's own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure } from "@sdxc/result";

import type { Exec, ExecOptions, ExecOutput, ExecError } from "./exec.js";
import type { Input, Keyboard } from "./keys.js";
import type { PromptKind, PromptKinds } from "./prompt.js";
import type { Output } from "./screen.js";
import type { Env, Style } from "./style.js";

import { CancelledError } from "./errors.js";
import { spawnExec } from "./exec.js";
import { interaction } from "./interactions.js";
import { isCancel, openKeyboard } from "./keys.js";
import { Screen } from "./screen.js";
import { colorEnabled, createStyle } from "./style.js";
import { Tasks } from "./task.js";

/** What `cli.run` replaces of the process: any option left out is the process's own. */
export interface RunIO {
	cwd?: string;
	env?: Env;
	stdin?: Input;
	stdout?: Output;
	stderr?: Output;
	/** Runs `ctx.exec`'s commands. */
	exec?: Exec;
	/**
	 * Aborting it stops the run the way Ctrl+C does. Without one, the run listens for SIGINT and
	 * SIGTERM itself while it lasts.
	 */
	signal?: AbortSignal;
}

/** How a test harness answers prompts in place of a person. */
export interface Script {
	/** By the name a prompt answers to, or in the order prompts are asked. */
	answers: Readonly<Record<string, unknown>> | readonly unknown[] | undefined;
	/** Reads keys from a virtual terminal; without one, prompts take scripted answers. */
	keyboard: (() => Keyboard) | undefined;
	/** Whether stdin counts as a terminal, which decides whether prompts are asked at all. */
	interactive: boolean;
}

/** One question to ask, in the shape both bound and handler-called prompts reduce to. */
export interface PromptRequest {
	kind: PromptKind;
	options: PromptKinds[PromptKind];
	/** Names a scripted `answers` object may answer it by. */
	names: readonly string[];
	/** How errors about it name it: `--template`, `<directory>`, or its message. */
	label: string;
	/** The default, shown dimmed or preselected. */
	initial: unknown;
	/** Converts and checks an answer; the issue keeps the prompt open. */
	check(answer: unknown): Promise<Result<unknown, Error>>;
}

/** The process context of one run. */
export interface Session {
	cwd: string;
	env: Env;
	stdout: Output;
	stderr: Output;
	/** Styling for stdout, with stderr's under `stderr`. */
	style: Style & { readonly stderr: Style };
	screen: Screen;
	tasks: Tasks;
	signal: AbortSignal;
	/** Whether prompts are asked; otherwise defaults apply. */
	interactive: boolean;
	/** Whether tasks animate, false once `--no-progress` is passed. */
	animate: boolean;
	ask(request: PromptRequest): Promise<Result<unknown, Error>>;
	exec(
		command: readonly string[],
		options?: ExecOptions,
	): Promise<Result<ExecOutput, ExecError | CancelledError>>;
	/** Stops tasks, clears the frame, shows the cursor and stops listening for signals. */
	close(): void;
}

/** Whether the environment asks for plain task output: in CI or on a dumb terminal. */
function plainProgress(env: Env): boolean {
	let ci = env.CI;
	return (ci !== undefined && ci !== "" && ci !== "0" && ci !== "false") || env.TERM === "dumb";
}

/** The process's environment as a plain record. */
function processEnv(): Env {
	return { ...process.env };
}

/**
 * Opens the session for one run.
 *
 * @param noProgress - Whether `--no-progress` was passed
 * @param script - How a test answers prompts; `undefined` for a person at a terminal
 */
export function openSession(io: RunIO, noProgress: boolean, script: Script | undefined): Session {
	let env = io.env ?? processEnv();
	let stdin = io.stdin ?? (process.stdin as Input);
	let stdout = io.stdout ?? process.stdout;
	let stderr = io.stderr ?? process.stderr;
	let controller = new AbortController();
	let unlink: (() => void)[] = [];
	if (io.signal !== undefined) {
		let forward = () => controller.abort(new CancelledError());
		if (io.signal.aborted) forward();
		else io.signal.addEventListener("abort", forward, { once: true });
		unlink.push(() => io.signal?.removeEventListener("abort", forward));
	}
	let screen = new Screen(stderr);
	let raw = false;
	let restore = () => {
		screen.restore();
		if (raw) stdin.setRawMode?.(false);
		raw = false;
	};
	if (io.signal === undefined && io.stderr === undefined) {
		let onSignal = (name: NodeJS.Signals) => () => {
			if (controller.signal.aborted) {
				restore();
				process.exit(name === "SIGINT" ? 130 : 143);
			}
			controller.abort(new CancelledError());
		};
		let onInt = onSignal("SIGINT");
		let onTerm = onSignal("SIGTERM");
		process.on("SIGINT", onInt);
		process.on("SIGTERM", onTerm);
		process.on("exit", restore);
		unlink.push(() => {
			process.off("SIGINT", onInt);
			process.off("SIGTERM", onTerm);
			process.off("exit", restore);
		});
	}
	let terminal = stdin.isTTY === true && stderr.isTTY === true;
	let interactive = script === undefined ? terminal : script.interactive;
	let animate = stderr.isTTY === true && !noProgress && !plainProgress(env);
	let stderrStyle = createStyle(colorEnabled(stderr, env));
	let style = Object.assign(createStyle(colorEnabled(stdout, env)), { stderr: stderrStyle });
	let tasks = new Tasks(screen, stderrStyle, animate, controller.signal);
	let exec = io.exec ?? spawnExec;
	let answered = 0;
	let cwd = io.cwd ?? process.cwd();

	/** A scripted answer for `request`, or `undefined` when the script has none. */
	let scripted = (request: PromptRequest): { value: unknown } | undefined => {
		let answers = script?.answers;
		if (answers === undefined) return undefined;
		if (Array.isArray(answers)) {
			if (answered >= answers.length) return undefined;
			answered += 1;
			return { value: answers[answered - 1] };
		}
		let byName = answers as Readonly<Record<string, unknown>>;
		for (let name of request.names) {
			if (Object.hasOwn(byName, name)) return { value: byName[name] };
		}
		return undefined;
	};

	/** The line an answered prompt leaves behind. */
	let summaryLine = (request: PromptRequest, answer: unknown) => {
		let shown = interaction(request.kind, request.options, request.initial).summary(answer);
		let message = stderrStyle.bold(request.options.message);
		return `${stderrStyle.green("✓")} ${message}${shown === "" ? "" : ` ${stderrStyle.dim(shown)}`}\n`;
	};

	/** Asks on the terminal, key by key, until an answer passes its check or the user cancels. */
	let converse = async (request: PromptRequest, keyboard: Keyboard) => {
		let state = interaction(request.kind, request.options, request.initial);
		let issue: string | undefined;
		let header = `${stderrStyle.cyan("?")} ${stderrStyle.bold(request.options.message)}`;
		screen.hold();
		try {
			for (;;) {
				let lines = state.render(stderrStyle, header);
				if (issue !== undefined) lines.push(stderrStyle.red(`  ${issue}`));
				screen.paint(lines);
				let key = await keyboard.read(controller.signal);
				if (key === null) {
					screen.paint([]);
					if (controller.signal.aborted) return failure(new CancelledError());
					return failure(new Error(`No more keys while asking ${request.label}`));
				}
				if (isCancel(key)) {
					screen.paint([]);
					return failure(new CancelledError());
				}
				let step = state.key(key);
				if (step === undefined) {
					issue = undefined;
					continue;
				}
				if ("error" in step) {
					issue = step.error;
					continue;
				}
				let checked = await request.check(step.submit);
				if (isFailure(checked)) {
					issue = checked.error.message;
					continue;
				}
				screen.paint([]);
				stderr.write(summaryLine(request, step.submit));
				return checked;
			}
		} finally {
			screen.release();
		}
	};

	return {
		cwd,
		env,
		stdout,
		stderr,
		style,
		screen,
		tasks,
		signal: controller.signal,
		interactive,
		animate,
		async ask(request) {
			if (controller.signal.aborted) return failure(new CancelledError());
			if (script !== undefined && script.keyboard === undefined) {
				let answer = scripted(request);
				if (answer === undefined) {
					return failure(
						new Error(
							`invoke() has no scripted answer for ${request.label} ("${request.options.message}")`,
						),
					);
				}
				let checked = await request.check(answer.value);
				if (isFailure(checked)) {
					return failure(
						new Error(
							`invoke()'s answer for ${request.label} was rejected: ${checked.error.message}`,
						),
					);
				}
				screen.write(stderr, summaryLine(request, answer.value));
				return checked;
			}
			let keyboard =
				script?.keyboard?.() ??
				openKeyboard(stdin, (on) => {
					raw = on;
				});
			try {
				return await converse(request, keyboard);
			} finally {
				keyboard.close();
			}
		},
		async exec(command, options = {}) {
			let stdio = options.stdio ?? "inherit";
			let shares = stdio === "inherit" || stdio === "stderr";
			if (shares) screen.hold();
			try {
				return await exec(command, {
					cwd: options.cwd ?? cwd,
					env: { ...env, ...options.env },
					stdio,
					signal: options.signal ?? controller.signal,
					input: options.input,
					stdout,
					stderr,
				});
			} finally {
				if (shares) screen.release();
			}
		},
		close() {
			tasks.close();
			restore();
			for (let each of unlink) each();
		},
	};
}
