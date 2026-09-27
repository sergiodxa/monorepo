/**
 * Publishes the mailer an HTTP request sends through, over the platform's own
 * `SEND_EMAIL` binding and configured sender — the same singleton-per-isolate
 * shape `app/jobs/middleware/mail.ts` already installs as `ctx.mail` for a job,
 * built here for `remix/router`'s `RequestContext` instead. Shared by every
 * router that needs to send mail, since opening the transport is identical
 * regardless of which one is serving the request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Mailer as MailClient } from "@sdxc/mail";
import type { Middleware } from "remix/router";

import { Mailer } from "@sdxc/mail";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";
import { createContextKey } from "remix/router";

import { parseSenderAddress } from "~/app/mail/sender";

/** Where a router's mailer lives on the context, installed as `ctx.mail`. */
export const Mail = createContextKey<MailClient>();

declare module "remix/router" {
	interface RequestContext {
		/** The mailer every route sends through. */
		mail: MailClient;
	}
}

/** The isolate's mailer, built by whichever request sends first. */
let instance: MailClient | undefined;

/**
 * Opens the mailer a route sends through, over the platform's own
 * `SEND_EMAIL` binding and configured sender.
 *
 * @returns A mailer shared by every request this isolate serves.
 */
function createMailer(): MailClient {
	return (instance ??= new Mailer({
		transport: new CloudflareTransport(env.SEND_EMAIL),
		from: parseSenderAddress(env.EMAIL_FROM),
	}));
}

/**
 * Publishes a mailer for the request about to run.
 *
 * @returns The middleware installing it as `ctx.mail`.
 * @example
 * let globalMiddleware: Middleware[] = [trailingSlash, log(logger), asyncContext(), database(createDatabase), formData(), apiVersioning(), mail()];
 */
export function mail(): Middleware {
	return (ctx, next) => {
		ctx.set(Mail, createMailer(), { property: "mail" });
		return next();
	};
}
