/**
 * Job middleware that opens the mailer a job sends through and publishes it on the
 * context, so a handler reads `ctx.mailer` and a test hands in one that records instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobMiddleware } from "@sdxc/jobs";
import type { Mailer as MailerClient } from "@sdxc/mail";

import { createContextKey } from "remix/router";

import { createMailer } from "~/app/lib/mailer";

/** Where a job's mailer lives on the context, installed as `ctx.mailer`. */
export const Mailer = createContextKey<MailerClient>();

/** What {@link mailer} publishes, which is what types `ctx.mailer` for handlers. */
export type MailerEffect = {
	key: typeof Mailer;
	value: MailerClient;
	property: "mailer";
};

/**
 * Publishes a mailer for the job about to run.
 *
 * @returns The middleware, for a dispatcher's chain.
 * @example createJobDispatcher({ middleware: [costLedger(), database(), mailer()] });
 */
export function mailer(): JobMiddleware<MailerEffect> {
	return async (ctx, next) => {
		ctx.set(Mailer, createMailer(), { property: "mailer" });
		await next();
	};
}
