/**
 * `@sdxc/cli` middleware that publishes the app's mailer to a command as `ctx.email`, so an admin
 * command resends an invitation or a receipt with the same templates a route uses, through
 * whichever transport the app passes for where the command runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyCommandContext, CommandMiddleware } from "@sdxc/cli";

import { currentLog } from "@sdxc/logger";
import { failure, isFailure } from "@sdxc/result";

import type { MailError } from "./errors.js";
import type { MailerOptions } from "./mailer.js";
import type { Transport } from "./types.js";

import { CurrentMailer } from "./context.js";
import { Mailer } from "./mailer.js";

export { CurrentMailer } from "./context.js";

/** Options that configure the command-line mail middleware. */
export interface MailCommandOptions extends Omit<MailerOptions, "transport"> {
	/**
	 * Transport used for delivery, or a factory that resolves one per run from the command's
	 * context, such as one that reads `ctx.flags.remote` to pick the production transport.
	 */
	transport: Transport | ((ctx: AnyCommandContext) => Transport);
}

/**
 * Publishes a mailer as `ctx.email` for the run. Messages queued with `later()` send once the
 * handler returns, each outcome is recorded on the run's log, and a failed deferred send fails
 * the run, so whoever ran the command sees that a message never left.
 *
 * @param options - Transport and sender configuration; see {@link MailCommandOptions}.
 * @returns A middleware that installs `ctx.email`.
 * @example createCLI({ name: "app", commands, middleware: [mail({ transport: new MemoryTransport(), from: SENDER })] });
 */
export default function mail(
	options: MailCommandOptions,
): CommandMiddleware<{ key: typeof CurrentMailer; value: Mailer; property: "email" }> {
	return async (ctx, next) => {
		let transport =
			typeof options.transport === "function" ? options.transport(ctx) : options.transport;

		let mailer = new Mailer({
			transport,
			from: options.from,
			replyTo: options.replyTo,
			headers: options.headers,
		});

		ctx.set(CurrentMailer, mailer, { property: "email" });

		let failed: MailError | undefined;
		try {
			await next();
		} finally {
			failed = await flush(mailer);
		}
		if (failed !== undefined) return failure(failed);
	};
}

/**
 * Sends the mailer's deferred queue, recording each outcome on the run's log.
 *
 * @returns The first send's error, or `undefined` when every message left.
 */
async function flush(mailer: Mailer): Promise<MailError | undefined> {
	let log = currentLog();
	let failed: MailError | undefined;
	for (let result of await mailer.flush()) {
		if (isFailure(result)) {
			log?.warn("mail.send_failed", { error: result.error.message });
			failed ??= result.error;
		} else {
			log?.set({ mail: { sent: true } }).note("mail.sent", { message_id: result.data.messageId });
		}
	}
	return failed;
}
