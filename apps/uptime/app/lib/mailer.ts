/**
 * The mailer for the send paths with no request behind them — the check jobs and the
 * queue consumer — sharing the mail middleware's sender identity. A request handler uses
 * `ctx.email` instead, since only that instance's `later()` queue flushes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Mailer } from "@sdxc/mail";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";

/** The isolate's mailer, built by whichever job sends first. */
let instance: Mailer | undefined;

/**
 * Opens the mailer a job sends through.
 *
 * @returns A mailer bound to the `EMAIL` binding, shared by every job this isolate runs.
 * @example
 * let middleware = [costLedger(), database(), mailer(createMailer)];
 */
export function createMailer(): Mailer {
	return (instance ??= new Mailer({
		transport: new CloudflareTransport(env.EMAIL),
		from: MAIL_FROM,
		replyTo: MAIL_REPLY_TO,
	}));
}
