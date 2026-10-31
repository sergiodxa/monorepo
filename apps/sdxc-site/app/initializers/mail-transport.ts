/**
 * How the site's mail leaves the Worker: Cloudflare's `send_email` binding, from an address on
 * `sdxc.dev`. The binding is read on the first send, so a request that sends nothing touches
 * no binding, and a test replaces this module to record what would have been sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

/** The isolate's binding transport, opened by the first message sent. */
let binding: Transport | undefined;

/**
 * The transport the contact route's mailer delivers through, reading `EMAIL` on first send.
 *
 * @example mail({ transport, from: MAIL_FROM, mail: registry });
 */
export const transport: Transport = {
	async send(message) {
		binding ??= new CloudflareTransport(env.EMAIL);
		return await binding.send(message);
	},
};
