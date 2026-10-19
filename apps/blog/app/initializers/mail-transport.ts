/**
 * How a job's mail leaves the worker: the `EMAIL` binding, or, on a deployment without one, a
 * transport that refuses every message, so a job that sends retries until the binding exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";

import { MailError } from "@sdxc/mail";
import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { failure } from "@sdxc/result";
import { env } from "cloudflare:workers";

/** Refuses every message, standing in for an `EMAIL` binding the deployment does not declare. */
const UNBOUND_TRANSPORT: Transport = {
	async send() {
		return failure(new MailError("The worker has no email binding."));
	},
};

/**
 * The transport a job's mailer delivers through, read per run.
 *
 * @returns The `EMAIL` binding's transport, or one that refuses every message without it.
 */
export function mailTransport(): Transport {
	return env.EMAIL ? new CloudflareTransport(env.EMAIL) : UNBOUND_TRANSPORT;
}
