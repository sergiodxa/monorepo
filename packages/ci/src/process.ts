/**
 * Child processes for steps and for the git and gh calls the runner makes: a command line runs
 * through the shell, an argv runs without one, and stdout and stderr land in one buffer in the
 * order they were written, so a failed step's log reads the way a terminal would show it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** A command that exited 0. */
export interface CommandOutput {
	stdout: string;
	/** stdout and stderr interleaved as written. */
	output: string;
}

/** A command that could not start, exited non-zero, or was stopped by its signal. */
export class CommandError extends Error {
	override name = "CommandError";

	/**
	 * @param command - The command as typed, for the message
	 * @param code - The exit code; `null` when the command never started or was killed
	 * @param output - stdout and stderr interleaved as written
	 */
	constructor(
		readonly command: string,
		readonly code: number | null,
		readonly output: string,
	) {
		super(code === null ? `${command} did not finish` : `${command} exited with code ${code}`);
	}
}

/** Where a command runs and what it can see. */
export interface SpawnOptions {
	cwd: string;
	env?: Readonly<Record<string, string | undefined>>;
	signal?: AbortSignal;
	/** Receives each chunk of output as it arrives. */
	onOutput?: (text: string) => void;
}

/**
 * Runs `command` to completion and never rejects: a missing program, a non-zero exit and an
 * abort all resolve to a `CommandError` carrying whatever the command printed.
 *
 * @param command - A shell command line, or an argv run without a shell
 */
export function runCommand(
	command: string | readonly string[],
	options: SpawnOptions,
): Promise<Result<CommandOutput, CommandError>> {
	let typed = typeof command === "string" ? command : command.join(" ");
	let [program, ...args] = typeof command === "string" ? [command] : command;
	return new Promise((resolve) => {
		let stdout = "";
		let output = "";
		let child = spawn(program ?? "", args, {
			cwd: options.cwd,
			env: { ...process.env, ...options.env },
			shell: typeof command === "string",
			stdio: ["ignore", "pipe", "pipe"],
		});
		/** Appends a chunk to the combined log and hands it to the caller as it arrives. */
		let record = (chunk: Buffer): void => {
			let text = chunk.toString("utf8");
			output += text;
			options.onOutput?.(text);
		};
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
			record(chunk);
		});
		child.stderr.on("data", record);
		/** Stops the command when the step is aborted. */
		let abort = (): void => {
			child.kill("SIGTERM");
		};
		if (options.signal?.aborted) abort();
		options.signal?.addEventListener("abort", abort, { once: true });
		child.on("error", (error) => {
			options.signal?.removeEventListener("abort", abort);
			resolve(failure(new CommandError(typed, null, `${output}${error.message}\n`)));
		});
		child.on("close", (code) => {
			options.signal?.removeEventListener("abort", abort);
			if (code === 0) resolve(success({ stdout, output }));
			else resolve(failure(new CommandError(typed, code, output)));
		});
	});
}
