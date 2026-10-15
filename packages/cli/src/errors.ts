/**
 * The failures a command answers and the exit codes they map to: a usage failure prints the
 * command's help and exits 2, a cancelled one exits 130 in silence, an exit failure picks its
 * own code, and any other failure prints its message and exits 1.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Failure, Success } from "@sdxc/result";

import { failure, success as succeed } from "@sdxc/result";

/** The exit code each outcome of a run maps to, shared by every command line built here. */
export const EXIT_CODES = {
	success: 0,
	failure: 1,
	usage: 2,
	cancelled: 130,
} as const;

/** A command line the user wrote wrong; the run prints the message and the command's help. */
export class UsageError extends Error {
	override name = "UsageError";
}

/**
 * The user stopped the run, with Ctrl+C or Escape at a prompt or Ctrl+C during a task. The run
 * exits 130 and writes nothing more, since the user already knows why it stopped.
 */
export class CancelledError extends Error {
	override name = "CancelledError";

	/** @param message - Read only by code that logs the failure; the run itself prints nothing */
	constructor(message = "Cancelled") {
		super(message);
	}
}

/**
 * A failure that picks its own exit code. An empty message prints nothing, for a command that
 * already reported what went wrong, such as a test runner that printed its failed tests.
 */
export class ExitError extends Error {
	override name = "ExitError";

	/** The process exit code the run answers. */
	code: number;

	/**
	 * @param code - The exit code
	 * @param message - What the run prints on stderr, nothing when empty
	 */
	constructor(code: number, message = "") {
		super(message);
		this.code = code;
	}
}

/**
 * A successful outcome; a command that has nothing to hand back calls it with no argument.
 *
 * @example return success();
 */
export function success(): Success<undefined>;
export function success<T>(data: T): Success<T>;
export function success(data?: unknown): Success<unknown> {
	return succeed(data);
}

/**
 * A usage failure: the run prints `message`, then the help of the command that answered it, and
 * exits 2.
 *
 * @example if (ctx.flags.prompt && !ctx.flags.from) return usage("--prompt needs --from");
 */
export function usage(message: string): Failure<UsageError> {
	return failure(new UsageError(message));
}

/** A cancelled failure, which exits 130 without printing anything. */
export function cancelled(): Failure<CancelledError> {
	return failure(new CancelledError());
}

/**
 * A failure that exits with `code`, printing `message` when one is given.
 *
 * @example return run.failed > 0 ? exit(1) : success();
 */
export function exit(code: number, message?: string): Failure<ExitError> {
	return failure(new ExitError(code, message));
}

/** The exit code a run's failure maps to. */
export function exitCodeOf(error: Error): number {
	if (error instanceof UsageError) return EXIT_CODES.usage;
	if (error instanceof CancelledError) return EXIT_CODES.cancelled;
	if (error instanceof ExitError) return error.code;
	return EXIT_CODES.failure;
}
