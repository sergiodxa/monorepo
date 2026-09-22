/**
 * Publishes the mailer a management API route sends through, over the platform's
 * own `SEND_EMAIL` binding and configured sender — the same singleton-per-isolate
 * shape `app/jobs/middleware/mail.ts` already installs as `ctx.mail` for a job,
 * built here for `remix/router`'s `RequestContext` instead.
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

/** Where the management router's mailer lives on the context, installed as `ctx.mail`. */
export const Mail = createContextKey<MailClient>();

declare module "remix/router" {
	interface RequestContext {
		/** The mailer every management route sends through. */
		mail: MailClient;
	}
}

/** The isolate's mailer, built by whichever management request sends first. */
let instance: MailClient | undefined;

/**
 * Opens the mailer a management route sends through, over the platform's own
 * `SEND_EMAIL` binding and configured sender.
 *
 * @returns A mailer shared by every management request this isolate serves.
 */
function createManagementMailer(): MailClient {
	return (instance ??= new Mailer({
		transport: new CloudflareTransport(env.SEND_EMAIL),
		from: parseSenderAddress(env.EMAIL_FROM),
	}));
}

/**
 * Publishes a mailer for the management request about to run.
 *
 * @returns The middleware installing it as `ctx.mail`.
 * @example
 * let globalMiddleware: Middleware[] = [trailingSlash, log(logger), asyncContext(), database(createDatabase), formData(), apiVersioning(), mail()];
 */
export function mail(): Middleware {
	return (ctx, next) => {
		ctx.set(Mail, createManagementMailer(), { property: "mail" });
		return next();
	};
}
