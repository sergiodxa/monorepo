/**
 * Where the Worker's email goes: Cloudflare's `send_email` binding, which delivers through
 * Email Routing, and the `email` job `ctx.email.queue()` hands deliveries to. Both run only in
 * the Worker, so the command line never imports this module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueuedEmail } from "@sdxc/mail";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

import { enqueue } from "~/app/initializers/queue";
import jobs from "~/app/jobs";

/** Sends through the `EMAIL` binding, from an address on a domain Email Routing verified. */
export const transport = new CloudflareTransport(env.EMAIL);

/**
 * Hands a queued email to the `email` job, which delivers it with retries; the write is billed
 * like every other enqueue.
 *
 * @param delivery - The declared email's name, its recipient, locale and props.
 */
export async function queue(delivery: QueuedEmail): Promise<void> {
	await enqueue(jobs.email, delivery);
}
