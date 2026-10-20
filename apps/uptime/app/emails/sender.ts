/**
 * Sender identity every message this app puts in an inbox carries. It lives in one
 * module because the router, the job dispatcher and the command line each configure a
 * mailer, and a product whose `From` disagreed between an invite and an alert would look
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address } from "@sdxc/mail";

/** Mailbox every message is sent from; the domain has to stay a verified sender. */
export const MAIL_FROM: Address = { email: "no-reply@uptime.sergiodxa.com", name: "Uptime" };

/** Mailbox replies go to, since {@link MAIL_FROM} is never read by a person. */
export const MAIL_REPLY_TO: Address = { email: "hello@sergiodxa.com" };
