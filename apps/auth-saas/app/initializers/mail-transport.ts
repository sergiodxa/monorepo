/**
 * Where the Worker's email goes: the `SEND_EMAIL` binding, from the platform's configured
 * `EMAIL_FROM` sender, and the `email` job `ctx.email.queue()` hands deliveries to. Every
 * router and the job dispatcher build their mailer from these, so all mail shares one identity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueuedEmail } from "@sdxc/mail";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

import { parseSenderAddress } from "~/app/emails/sender";
import jobs from "~/app/jobs";

/** Sends through the `SEND_EMAIL` binding, from an address on a domain Email Routing verified. */
export const transport = new CloudflareTransport(env.SEND_EMAIL);

/** The platform's own sender; a tenant's email overrides only its display name. */
export const MAIL_FROM = parseSenderAddress(env.EMAIL_FROM);

/**
 * Hands a queued email to the `email` job, which delivers it with retries. The dispatcher is
 * imported when the first email is queued, since its own middleware imports this module.
 *
 * @param delivery - The declared email's name, its recipient, locale and props.
 */
export async function queue(delivery: QueuedEmail): Promise<void> {
	let { dispatcher } = await import("~/app/initializers/dispatcher");
	await dispatcher.enqueue(jobs.email, delivery);
}
