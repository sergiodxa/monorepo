/**
 * Sender identity every message this server puts in an inbox carries. It lives in one
 * module because two send paths configure a mailer — the request-scoped one at the mail
 * middleware and the background one at the service container — and an identity provider
 * whose `From` disagreed between a sign-in alert and a password reset would look like a
 * phishing attempt rather than like one product.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address } from "@pkg/mail";

/**
 * Mailbox every message is sent from.
 *
 * On the issuer's own hostname rather than the apex domain, because that is the name the
 * reader just typed a password into and the one they can be asked to recognize; it also
 * keeps this server's sending reputation separate from every other app's. The domain has
 * to stay a verified sender, with SPF, DKIM and DMARC in place, or mail is refused or
 * silently filtered.
 *
 * Not an environment variable: it is a product decision, not a deployment one, and a
 * `From` that could differ per environment is a `From` that can be wrong in production
 * without anything failing.
 */
export const MAIL_FROM: Address = { email: "no-reply@auth.sergiodxa.com", name: "Auth" };

/**
 * Mailbox replies go to, since {@link MAIL_FROM} is never read by a person. Someone who
 * answers a security notice is answering about their account, and that reply has to
 * reach a human.
 */
export const MAIL_REPLY_TO: Address = { email: "hello@sergiodxa.com" };
