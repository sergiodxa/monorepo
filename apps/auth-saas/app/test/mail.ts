/**
 * Mailers for tests: they render the app's declared emails through its registry and deliver
 * what `ctx.email.queue()` hands them at once, through the same transport, so a test reads a
 * queued email from its memory transport as soon as the request that queued it returns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address, QueuedEmail, Transport } from "@sdxc/mail";

import { Mailer } from "@sdxc/mail";

import { mail } from "~/app/initializers/mail";

/** The sender a test mailer applies to every email that names none of its own. */
export const TEST_SENDER: Address = { email: "noreply@auth.example.com", name: "Auth SaaS" };

/**
 * Stands in for the `email` job: delivers each queued email the moment it is queued.
 *
 * @param transport - Where delivered email lands.
 * @param from - The sender the job's mailer would apply.
 * @returns The `queue` option a mailer or the mail middleware takes.
 */
export function deliverQueued(
	transport: Transport,
	from: Address = TEST_SENDER,
): (delivery: QueuedEmail) => Promise<void> {
	let mailer = new Mailer({ transport, from, mail });
	return async (delivery) => {
		await mailer.deliver(delivery);
	};
}

/**
 * A mailer over `transport` that sends the app's declared emails and delivers queued ones
 * immediately, for a test publishing `ctx.email` itself.
 *
 * @param transport - Where every email lands.
 * @param from - The sender applied to every email.
 * @returns The mailer to publish under `CurrentMailer`.
 */
export function createTestMailer(transport: Transport, from: Address = TEST_SENDER): Mailer {
	return new Mailer({ transport, from, mail, queue: deliverQueued(transport, from) });
}
