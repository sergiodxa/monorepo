/**
 * The process boundary every release command crosses: `run` spawns a child, collects both of
 * its streams and answers a non-zero exit or a failed spawn as a `CommandError` carrying the
 * code and the output, so callers read a `Result` and no command ever throws into them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

const EXEC_FILE = promisify(execFile);

/** Node's own cap on each collected stream, in force when a caller sets none. */
const OUTPUT_LIMIT = 1024 * 1024;

export interface CommandOutput {
	stdout: string;
	stderr: string;
}

export interface CommandOptions {
	cwd: string;
	maxBuffer?: number;
	/** Receives the child's stderr as it arrives, so a long command shows its progress live. */
	onStderr?: (chunk: string) => void;
}

/** What Node attaches to a child's rejection: how it ended, and the output collected until then. */
interface ChildFailure extends Error {
	code?: number | string | null;
	stdout?: string;
	stderr?: string;
}

/**
 * A command that ended without exiting zero, as the release reads it: how it ended and what it
 * wrote, so a caller can read npm's JSON error object or show git's own words to the operator.
 */
export class CommandError extends Error {
	/**
	 * The exit status; a spawn code such as `ENOENT` when the executable never started; `null`
	 * when a signal ended the child.
	 */
	readonly code: number | string | null;

	/** Everything the child wrote to stdout, which npm's `--json` fills even on failure. */
	readonly stdout: string;

	/** Everything the child wrote to stderr, where git, gh and npm explain themselves. */
	readonly stderr: string;

	/** Reads the code and both streams from the rejection Node's `execFile` produced for `file` and `args`. */
	constructor(file: string, args: string[], cause: Error) {
		let { code = null, stdout = "", stderr = "" } = cause as ChildFailure;
		super(describeFailure(file, args, code, stderr), { cause });
		this.name = "CommandError";
		this.code = code;
		this.stdout = stdout;
		this.stderr = stderr;
	}
}

/**
 * Runs `file` with `args` in `options.cwd` and resolves to both streams once it exits zero;
 * every other outcome, a failed spawn included, resolves to a `CommandError`, so the promise
 * settles as a `Result` in every case.
 */
export async function run(
	file: string,
	args: string[],
	options: CommandOptions,
): Promise<Result<CommandOutput, CommandError>> {
	let pending = EXEC_FILE(file, args, {
		cwd: options.cwd,
		maxBuffer: options.maxBuffer ?? OUTPUT_LIMIT,
	});
	let { onStderr } = options;
	if (onStderr !== undefined) {
		pending.child.stderr?.on("data", (chunk: Buffer | string) => {
			onStderr(chunk.toString());
		});
	}
	let result = await wrap(() => pending);
	if (isFailure(result)) return failure(new CommandError(file, args, result.error));
	return success(result.data);
}

/**
 * `` `git rev-parse HEAD` exited with 128: fatal: not a git repository ``: the command, how it
 * ended, and the first stderr line when there is one.
 */
function describeFailure(
	file: string,
	args: string[],
	code: number | string | null,
	stderr: string,
): string {
	let ending = `\`${[file, ...args].join(" ")}\` ${endedWith(code)}`;
	let detail = stderr.split("\n").find((line) => line.trim() !== "");
	return detail === undefined ? ending : `${ending}: ${detail.trim()}`;
}

/** The exit status, the spawn code when the executable never started, or the signal case. */
function endedWith(code: number | string | null): string {
	if (typeof code === "number") return `exited with ${code}`;
	if (code === null) return "was ended by a signal";
	return `failed with ${code}`;
}
