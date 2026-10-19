/**
 * How mail leaves this worker: the `EMAIL` binding every mailer the Worker builds delivers
 * through, and the `email` job `ctx.email.queue()` hands deliveries to. Both run only in the
 * Worker, so the command line, which prints its mail instead, never imports this module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueuedEmail, Transport } from "@sdxc/mail";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";

/** The isolate's binding transport, opened by the first message any mailer sends. */
let binding: Transport | undefined;

/**
 * The transport every Worker mailer delivers through. It reads the `EMAIL` binding on the
 * first send, so building a mailer for a request or a job that sends nothing reads no binding.
 *
 * @example mailer({ transport, from: MAIL_FROM, mail });
 */
export const transport: Transport = {
	async send(message) {
		binding ??= new CloudflareTransport(env.EMAIL);
		return await binding.send(message);
	},
};

/**
 * Hands a queued email to the `email` job, which delivers it with the queue's retries. The
 * dispatcher is imported when the first email is queued, since its own middleware imports
 * this module.
 *
 * @param delivery - The declared email's name, its recipient, locale and props.
 */
export async function queueEmail(delivery: QueuedEmail): Promise<void> {
	let { dispatcher } = await import("~/app/initializers/dispatcher");
	await dispatcher.enqueue(jobs.email, delivery);
}
