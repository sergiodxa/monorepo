/**
 * The mailer a job or service test hands its subject: the app's email registry and sender over
 * a transport the test reads, so a declared email renders exactly as it would in the Worker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";

import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";

import { MAIL_FROM } from "~/app/emails/sender";
import { mail } from "~/app/initializers/mail";

/**
 * A mailer that sends the app's declared emails through `transport`.
 *
 * @param transport - Where sent messages land; a fresh memory transport when omitted.
 * @returns The mailer, for `ctx.set(CurrentMailer, …, { property: "email" })` or a service call.
 * @example ctx.set(CurrentMailer, testMailer(transport), { property: "email" });
 */
export function testMailer(transport: Transport = new MemoryTransport()): Mailer {
	return new Mailer({ transport, from: MAIL_FROM, mail });
}
