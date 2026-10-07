/**
 * Publishes how mail leaves the worker to every job, as `ctx.mail`, so a job that sends
 * builds its mailer from it and a test hands it a transport that records instead of sending.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@sdxc/jobs";
import type { Transport } from "@sdxc/mail";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";
import { createContextKey } from "remix/router";

/** The transport a job sends through; `undefined` where the worker has no email binding. */
export const Mail = createContextKey<Transport | undefined>();

/**
 * Publishes the worker's `EMAIL` binding as a transport for the job about to run.
 *
 * @returns The middleware installing it as `ctx.mail`.
 * @example createJobDispatcher({ middleware: [database(), mail()] });
 */
export function mail(): JobMiddleware<{
	key: typeof Mail;
	value: Transport | undefined;
	property: "mail";
}> {
	return async (ctx, next) => {
		ctx.set(Mail, env.EMAIL ? new CloudflareTransport(env.EMAIL) : undefined, {
			property: "mail",
		});
		await next();
	};
}
