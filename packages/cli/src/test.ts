/**
 * `@sdxc/cli/test`: runs a CLI in a test the way a terminal does, collecting both streams,
 * answering prompts from a script, recording every child process against a table of replies,
 * and optionally drawing prompts on a virtual terminal driven by key presses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { EventEmitter } from "node:events";

import { failure, success } from "@sdxc/result";

import type { CLI } from "./cli.js";
import type { Group } from "./command.js";
import type { Exec, Stdio } from "./exec.js";
import type { Input, Key, Keyboard } from "./keys.js";
import type { AnyCommandMiddleware } from "./middleware.js";
import type { Output } from "./screen.js";
import type { Env } from "./style.js";

import { runScripted } from "./cli.js";
import { displayCommand, ExecError } from "./exec.js";
import { keysFromScript } from "./keys.js";
import { VirtualTerminal } from "./terminal.js";

/** What a recorded command answers: exit 0 and no output unless given. */
export interface ExecReply {
	/** @default 0 */
	code?: number;
	stdout?: string;
	stderr?: string;
}

/** One command the run executed. */
export interface ExecCall {
	command: string[];
	cwd: string;
	stdio: Stdio;
}

/** How `invoke` runs the CLI. */
export interface InvokeOptions {
	/** @default process.cwd() */
	cwd?: string;
	/** The whole environment the run sees. @default {} */
	env?: Env;
	/**
	 * Replies by command, keyed as a shell user writes it (`"git init"`), or an `Exec` that runs
	 * them. A command with no reply fails, naming itself, so nothing runs by accident.
	 * @default {}
	 */
	exec?: Readonly<Record<string, ExecReply>> | Exec;
	/**
	 * Prompt answers: an object answers by the flag or argument a prompt fills (its key or flag
	 * name) or a handler prompt's `name`; an array answers prompts in the order they are asked.
	 * A prompt with no answer fails the run, naming it.
	 */
	answers?: Readonly<Record<string, unknown>> | readonly unknown[];
	/**
	 * Whether stdin is a terminal. With `false`, nothing is asked: defaults apply, and a
	 * required input with a prompt is a usage error.
	 * @default true
	 */
	interactive?: boolean;
	/** Draws prompts and tasks on a virtual terminal this wide; prompts then read `keys`. */
	tty?: { columns?: number };
	/**
	 * Key presses for `tty`: `"enter"`, `"down"`, `"space"`, `"ctrl+c"`, a character, or longer
	 * text typed one character at a time.
	 */
	keys?: readonly string[];
	/** Aborting it stops the run the way Ctrl+C does. */
	signal?: AbortSignal;
	/**
	 * Text piped into the run, which `ctx.stdin.text()` reads. Piped stdin is no terminal, so
	 * `interactive` then defaults to `false`.
	 */
	stdin?: string;
}

/** What a run printed and how it ended. */
export interface Invocation {
	code: number;
	stdout: string;
	/** What stderr shows: plain text, or the virtual terminal's final screen with `tty`. */
	stderr: string;
	/** Every command `ctx.exec` ran, in order. */
	exec: ExecCall[];
	/** With `tty`, the screen after each key press. */
	screens: string[];
}

/** A stream that keeps what is written to it. */
class Capture implements Output {
	text = "";
	readonly isTTY = false;

	write(text: string): boolean {
		this.text += text;
		return true;
	}
}

/** An exec answering from `replies` and recording each call. */
function tableExec(replies: Readonly<Record<string, ExecReply>>, calls: ExecCall[]): Exec {
	return async (command, request) => {
		calls.push({ command: [...command], cwd: request.cwd, stdio: request.stdio });
		let shown = displayCommand(command);
		let reply = replies[shown];
		if (reply === undefined) {
			return failure(new ExecError(`invoke() has no reply for ${shown}`, { command, code: null }));
		}
		let stdout = reply.stdout ?? "";
		let stderr = reply.stderr ?? "";
		if (request.stdio === "inherit") {
			if (stdout !== "") request.stdout.write(stdout);
			if (stderr !== "") request.stderr.write(stderr);
		} else if (request.stdio === "stderr") {
			if (stdout !== "") request.stderr.write(stdout);
			if (stderr !== "") request.stderr.write(stderr);
		}
		let collected =
			request.stdio === "collect"
				? { stdout, stderr, output: stdout + stderr }
				: { stdout: "", stderr: "", output: "" };
		let code = reply.code ?? 0;
		if (code !== 0) {
			return failure(
				new ExecError(`${shown} exited with ${code}`, { command, code, ...collected }),
			);
		}
		return success({ code, ...collected });
	};
}

/**
 * A stdin that reports being a terminal or not. Read, a pipe produces `text` and ends, empty
 * when there is none; a terminal produces nothing.
 */
function scriptedInput(isTTY: boolean, text: string | undefined): Input {
	let emitter = new EventEmitter();
	let sent = false;
	return Object.assign(emitter, {
		isTTY,
		resume: () => {
			if (isTTY || sent) return;
			sent = true;
			queueMicrotask(() => {
				if (text !== undefined && text !== "") emitter.emit("data", text);
				emitter.emit("end");
			});
		},
		pause: () => undefined,
	});
}

/**
 * Runs `cli` with `argv` and answers what it printed.
 *
 * @example
 * let run = await invoke(cli, ["create", "app"], { answers: { template: "app", git: false } });
 * expect(run.code).toBe(0);
 * @example
 * let run = await invoke(cli, ["create"], { tty: { columns: 60 }, keys: ["my-app", "enter", "down", "enter"] });
 * run.screens[0]; // the prompt after "my-app" was typed
 */
export async function invoke<Commands extends Group, Chain extends readonly AnyCommandMiddleware[]>(
	cli: CLI<Commands, Chain>,
	argv: readonly string[],
	options: InvokeOptions = {},
): Promise<Invocation> {
	let stdout = new Capture();
	let terminal =
		options.tty === undefined ? undefined : new VirtualTerminal(options.tty.columns ?? 80);
	let capture = new Capture();
	let stderr: Output = terminal ?? capture;
	let calls: ExecCall[] = [];
	let exec =
		typeof options.exec === "function"
			? recording(options.exec, calls)
			: tableExec(options.exec ?? {}, calls);
	let screens: string[] = [];
	let keyboard: (() => Keyboard) | undefined;
	let pending = false;
	if (terminal !== undefined) {
		let keys: Key[] = keysFromScript(options.keys ?? []);
		keyboard = () => ({
			read() {
				if (pending) screens.push(terminal.screen());
				let key = keys.shift();
				pending = key !== undefined;
				return Promise.resolve(key ?? null);
			},
			close: () => undefined,
		});
	}
	let interactive = options.interactive ?? options.stdin === undefined;
	let code = await runScripted(
		cli,
		argv,
		{
			cwd: options.cwd ?? process.cwd(),
			env: options.env ?? {},
			stdin: scriptedInput(interactive, options.stdin),
			stdout,
			stderr,
			exec,
			signal: options.signal ?? new AbortController().signal,
		},
		{ answers: options.answers, keyboard, interactive },
	);
	if (pending && terminal !== undefined) screens.push(terminal.screen());
	return {
		code,
		stdout: stdout.text,
		stderr: terminal === undefined ? capture.text : terminal.screen(),
		exec: calls,
		screens,
	};
}

/** Records each call before handing it to `exec`. */
function recording(exec: Exec, calls: ExecCall[]): Exec {
	return (command, request) => {
		calls.push({ command: [...command], cwd: request.cwd, stdio: request.stdio });
		return exec(command, request);
	};
}
