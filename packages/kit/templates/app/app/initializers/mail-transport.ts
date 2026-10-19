/**
 * Where the Worker's email goes: Cloudflare's `send_email` binding, which `bun dev` simulates and
 * a deploy delivers through Email Routing, and the `email` job `ctx.email.queue()` hands
 * deliveries to. Both run only in the Worker, so the command line never imports this module.
 */

import type { QueuedEmail } from "@sdxc/mail";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";

/** Sends through the `EMAIL` binding, from an address on a domain Email Routing verified. */
export const transport = new CloudflareTransport(env.EMAIL);

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
