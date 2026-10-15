/**
 * `@sdxc/cli` middleware publishing a command run's log as `ctx.log`, under the key the router
 * entry uses. It joins the log already current or opens a `command` log of its own, so code
 * logs through `ctx.log` or `currentLog()` in a command exactly as it does in a route or a job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CommandMiddleware } from "@sdxc/cli";

import { CancelledError, EXIT_CODES, ExitError, UsageError } from "@sdxc/cli";

import type { Logger } from "./create-logger.js";

import { currentLog } from "./current.js";
import { Log } from "./log.js";
import { CurrentLog } from "./middleware.js";

export { CurrentLog } from "./middleware.js";

const LOG_PROPERTY = { property: "log" } as const;

/**
 * The exit code `@sdxc/cli` answers for a run whose chain threw `error`, so the record names
 * the code the shell saw.
 */
function exitCodeOf(error: unknown): number {
	if (error instanceof ExitError) return error.code;
	if (error instanceof UsageError) return EXIT_CODES.usage;
	if (error instanceof CancelledError) return EXIT_CODES.cancelled;
	return EXIT_CODES.failure;
}

/**
 * Publishes the command run's log as `ctx.log`, carrying `command.path` (`users find`) from the
 * start, so a record of a run that throws still names the command.
 *
 * When a log is already current it is joined, so a command run inside a host's log produces
 * one record, and the run's own `command.duration_ms` is recorded on it. Otherwise a `command`
 * log opens — carrying `logger`'s configuration when one is given — and is written once the
 * handler settles. A run that throws records `command.exit_code` as the code its error maps to.
 *
 * @param logger The app's configuration. Omitted, the log carries none.
 * @example createCLI({ name: "app", commands, middleware: [log(logger)] });
 */
export function log(
	logger?: Logger,
): CommandMiddleware<{ key: typeof CurrentLog; value: Log; property: "log" }> {
	return async (ctx, next) => {
		let path = ctx.path.join(" ");
		let current = currentLog();

		if (current !== undefined) {
			let started = performance.now();
			ctx.set(CurrentLog, current, LOG_PROPERTY);
			current.set({ command: { path } });
			try {
				await next();
			} catch (error) {
				current.set({ command: { exit_code: exitCodeOf(error) } });
				throw error;
			} finally {
				current.set({
					command: { duration_ms: Math.round((performance.now() - started) * 10) / 10 },
				});
			}
			return;
		}

		let fields = { command: { path } };
		let opened =
			logger === undefined ? new Log({ kind: "command" }, fields) : logger.open("command", fields);

		await opened.run(async (self) => {
			ctx.set(CurrentLog, self, LOG_PROPERTY);
			try {
				await next();
			} catch (error) {
				self.set({ command: { exit_code: exitCodeOf(error) } });
				throw error;
			}
		});
	};
}
