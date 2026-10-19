/**
 * How mail leaves this worker: the `EMAIL` binding every mailer the Worker builds delivers
 * through. It reads a Worker binding, so the command line, which prints its mail instead,
 * never imports this module. Swapping providers is one line here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

/** The isolate's transport, opened by whichever send path reaches it first. */
let transport: Transport | undefined;

/**
 * Opens the transport every message is delivered through.
 *
 * @returns A transport bound to the `EMAIL` binding, shared by every mailer.
 * @example mail({ transport: createMailTransport, from: MAIL_FROM, mail });
 */
export function createMailTransport(): Transport {
	return (transport ??= new CloudflareTransport(env.EMAIL));
}
