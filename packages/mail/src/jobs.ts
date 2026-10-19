/**
 * `@sdxc/jobs` middleware that publishes a mailer to every job as `ctx.email`, so a job sends
 * with the same templates and sender identity a route uses, and the job that delivers queued
 * email reads the mailer the rest of its dispatcher shares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobContext, JobMiddleware } from "@sdxc/jobs";

import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import type { MailerOptions } from "./mailer.js";
import type { Transport } from "./types.js";

import { CurrentMailer } from "./context.js";
import { Mailer } from "./mailer.js";

export { CurrentMailer } from "./context.js";

/** Options that configure the job mail middleware. */
export interface MailJobOptions extends Omit<MailerOptions, "transport"> {
	/** Transport used for delivery, or a factory that resolves one per run from the job's context. */
	transport: Transport | ((ctx: AnyJobContext) => Transport);
}

/**
 * Publishes a mailer as `ctx.email` for each run. Messages deferred with `later()` send once the
 * handler returns and each outcome is recorded on the run's log; a failed deferred send is a
 * warning there, since the job's own work already finished.
 *
 * @param options - Transport, sender, and the app's `createMail()` instance; see {@link MailJobOptions}.
 * @returns A middleware that installs `ctx.email`.
 * @example createJobDispatcher({ middleware: [mailer({ transport, from: MAIL_FROM, mail })] as const });
 */
export default function mail(
	options: MailJobOptions,
): JobMiddleware<{ key: typeof CurrentMailer; value: Mailer; property: "email" }> {
	return async (ctx, next) => {
		let transport =
			typeof options.transport === "function" ? options.transport(ctx) : options.transport;

		let mailer = new Mailer({ ...options, transport });

		ctx.set(CurrentMailer, mailer, { property: "email" });

		try {
			await next();
		} finally {
			let log = currentLog();
			for (let result of await mailer.flush()) {
				if (isFailure(result)) log?.warn("mail.send_failed", { error: result.error.message });
				else
					log
						?.set({ mail: { sent: true } })
						.note("mail.sent", { message_id: result.data.messageId });
			}
		}
	};
}
