/**
 * Child processes without a shell: arguments reach the program exactly as given, so nothing in
 * them is expanded or split. The answer is a `Result` carrying the exit code and what the child
 * printed, and an aborted signal stops the child and answers a cancelled failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";

import type { Result } from "@sdxc/result";

import { iife } from "@sdxc/iife";
import { failure, success } from "@sdxc/result";

import type { Output } from "./screen.js";
import type { Env } from "./style.js";

import { CancelledError } from "./errors.js";

/**
 * Where a child's output goes: `"inherit"` to the CLI's own streams, `"ignore"` nowhere,
 * `"collect"` into the answer only, and `"stderr"` sends the child's stdout to the CLI's stderr,
 * so a command whose stdout is piped keeps it clean while an install prints.
 */
export type Stdio = "inherit" | "ignore" | "collect" | "stderr";

/** How `ctx.exec` runs one command. */
export interface ExecOptions {
	/** @default the command's working directory */
	cwd?: string;
	/** Variables set on top of the command's environment. */
	env?: Env;
	/** @default "inherit" */
	stdio?: Stdio;
	/** Stops the child. @default the run's signal, which aborts on Ctrl+C */
	signal?: AbortSignal;
	/** Text written to the child's stdin, which is otherwise closed (or the terminal for "inherit"). */
	input?: string;
}

/** Everything an {@link Exec} receives, with every default filled in. */
export interface ExecRequest {
	cwd: string;
	env: Env;
	stdio: Stdio;
	signal: AbortSignal;
	input: string | undefined;
	/** The CLI's streams, for `"inherit"` and `"stderr"` output. */
	stdout: Output;
	stderr: Output;
}

/** A child that exited 0. */
export interface ExecOutput {
	code: number;
	/** What the child printed on stdout, empty unless it was collected. */
	stdout: string;
	stderr: string;
	/** Both streams in the order they arrived. */
	output: string;
}

/** A child that could not start or exited with a code other than 0. */
export class ExecError extends Error {
	override name = "ExecError";

	/** The command as given. */
	command: readonly string[];

	/** The exit code, or `null` when the child never started or ended on a signal. */
	code: number | null;

	stdout: string;
	stderr: string;
	output: string;

	/**
	 * @param message - What went wrong
	 * @param details - The command and what it printed
	 */
	constructor(
		message: string,
		details: {
			command: readonly string[];
			code: number | null;
			stdout?: string;
			stderr?: string;
			output?: string;
			cause?: unknown;
		},
	) {
		super(message, { cause: details.cause });
		this.command = details.command;
		this.code = details.code;
		this.stdout = details.stdout ?? "";
		this.stderr = details.stderr ?? "";
		this.output = details.output ?? "";
	}
}

/** Runs one command; `cli.run`'s `exec` option replaces it, as the test harness does. */
export type Exec = (
	command: readonly string[],
	request: ExecRequest,
) => Promise<Result<ExecOutput, ExecError | CancelledError>>;

/** The command as a shell user would read it, for messages. */
export function displayCommand(command: readonly string[]): string {
	return command
		.map((part) => (/^[\w./:=@-]+$/.test(part) ? part : JSON.stringify(part)))
		.join(" ");
}

/**
 * Spawns `command` with `node:child_process`. Output bound for the process's own streams is
 * inherited directly; output bound for any other stream is piped and forwarded to it.
 */
export const spawnExec: Exec = (command, request) =>
	new Promise((resolve) => {
		let settled = false;
		let settle = (outcome: Result<ExecOutput, ExecError | CancelledError>) => {
			if (settled) return;
			settled = true;
			resolve(outcome);
		};
		let [program, ...args] = command;
		if (program === undefined) {
			settle(failure(new ExecError("exec needs a command", { command, code: null })));
			return;
		}
		if (request.signal.aborted) {
			settle(failure(new CancelledError()));
			return;
		}
		let shown = displayCommand(command);
		let direct = (target: Output, stream: NodeJS.WriteStream) => target === stream;
		let outTarget: Output | null = null;
		if (request.stdio === "inherit") outTarget = request.stdout;
		else if (request.stdio === "stderr") outTarget = request.stderr;
		let errTarget: Output | null =
			request.stdio === "inherit" || request.stdio === "stderr" ? request.stderr : null;
		let stdout = iife((): "inherit" | "pipe" | "ignore" | number => {
			if (request.stdio === "ignore") return "ignore";
			if (outTarget === null) return "pipe";
			if (direct(outTarget, process.stdout)) return "inherit";
			if (direct(outTarget, process.stderr)) return 2;
			return "pipe";
		});
		let stderr: "inherit" | "pipe" | "ignore" = "pipe";
		if (request.stdio === "ignore") stderr = "ignore";
		else if (errTarget !== null && direct(errTarget, process.stderr)) stderr = "inherit";
		let stdin: "inherit" | "pipe" | "ignore" = "ignore";
		if (request.input !== undefined) stdin = "pipe";
		else if (request.stdio === "inherit") stdin = "inherit";
		let child = spawn(program, args, {
			cwd: request.cwd,
			env: { ...request.env } as NodeJS.ProcessEnv,
			shell: false,
			stdio: [stdin, stdout, stderr],
		});
		let collected = { stdout: "", stderr: "", output: "" };
		child.stdout?.on("data", (chunk: Buffer) => {
			let text = chunk.toString();
			if (outTarget === null) {
				collected.stdout += text;
				collected.output += text;
			} else outTarget.write(text);
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			let text = chunk.toString();
			if (errTarget === null) {
				collected.stderr += text;
				collected.output += text;
			} else errTarget.write(text);
		});
		if (request.input !== undefined) child.stdin?.end(request.input);
		let abort = () => child.kill("SIGTERM");
		request.signal.addEventListener("abort", abort, { once: true });
		child.once("error", (error) => {
			request.signal.removeEventListener("abort", abort);
			settle(
				failure(
					new ExecError(`${shown} could not start: ${error.message}`, {
						command,
						code: null,
						cause: error,
						...collected,
					}),
				),
			);
		});
		child.once("close", (code, signal) => {
			request.signal.removeEventListener("abort", abort);
			if (request.signal.aborted) {
				settle(failure(new CancelledError()));
				return;
			}
			if (code === 0) {
				settle(success({ code, ...collected }));
				return;
			}
			let reason = code === null ? `was stopped by ${signal ?? "a signal"}` : `exited with ${code}`;
			settle(failure(new ExecError(`${shown} ${reason}`, { command, code, ...collected })));
		});
	});
