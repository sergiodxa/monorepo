/**
 * Publishes the mailer a job sends through, sharing the tenant router's own
 * transport and sender identity, so a handler reads `ctx.mail` and a test hands in
 * one built over a recording transport instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@sdxc/jobs";
import type { Mailer as MailClient } from "@sdxc/mail";

import { Mailer } from "@sdxc/mail";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";
import { createContextKey } from "remix/router";

import { parseSenderAddress } from "~/app/mail/sender";

/** Where a job's mailer lives on the context, installed as `ctx.mail`. */
export const Mail = createContextKey<MailClient>();

/** The isolate's mailer, built by whichever job sends first. */
let instance: MailClient | undefined;

/**
 * Opens the mailer a job sends through, over the platform's own `SEND_EMAIL`
 * binding and configured sender.
 *
 * @returns A mailer shared by every job this isolate runs.
 */
function createJobMailer(): MailClient {
	return (instance ??= new Mailer({
		transport: new CloudflareTransport(env.SEND_EMAIL),
		from: parseSenderAddress(env.EMAIL_FROM),
	}));
}

/**
 * Publishes a mailer for the job about to run.
 *
 * @returns The middleware installing it as `ctx.mail`.
 * @example createJobDispatcher({ middleware: [database(), hostnames(), tenant(), mail()] });
 */
export function mail(): JobMiddleware<{
	key: typeof Mail;
	value: MailClient;
	property: "mail";
}> {
	return async (ctx, next) => {
		ctx.set(Mail, createJobMailer(), { property: "mail" });
		await next();
	};
}
