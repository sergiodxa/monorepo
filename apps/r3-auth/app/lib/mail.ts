/**
 * How mail leaves this worker, as one choice both mailers share: the request-scoped
 * mailer the mail middleware publishes as `ctx.email`, and the background one a send path
 * with no request behind it builds for itself. Swapping providers is one line here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Mailer } from "@sdxc/mail";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

import type { MailTransport } from "~/app/services/mail-transport";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";

/** The isolate's transport, opened by whichever send path reaches it first. */
let transport: MailTransport | undefined;

/**
 * Opens the transport every message is delivered through.
 *
 * @returns A transport bound to the `EMAIL` binding, shared by every mailer.
 * @example
 * mail({ transport: createMailTransport, from: MAIL_FROM });
 */
export function createMailTransport(): MailTransport {
	return (transport ??= new CloudflareTransport(env.EMAIL));
}

/**
 * Builds a mailer for a send path with no request behind it — a queue message or a
 * scheduled sweep — carrying the sender identity request paths use. A handler answering a
 * request sends through `ctx.email`, whose `later()` queue is flushed once the response is.
 *
 * @param mailTransport - How the message leaves the worker; defaults to this worker's own.
 * @returns A mailer carrying the app's sender identity.
 * @example
 * await createMailer().send({ to, subject, html });
 */
export function createMailer(mailTransport: MailTransport = createMailTransport()): Mailer {
	return new Mailer({ transport: mailTransport, from: MAIL_FROM, replyTo: MAIL_REPLY_TO });
}
