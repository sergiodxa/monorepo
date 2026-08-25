/**
 * Sender identity every message this server puts in an inbox carries. It lives in one
 * module because two send paths configure a mailer — the request-scoped one at the mail
 * middleware and the background one at the service container — and an identity provider
 * is trusted only while its `From` reads the same on a sign-in alert and a password
 * reset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address } from "@pkg/mail";

/**
 * Mailbox every message is sent from, on the issuer's own hostname so it matches the name
 * the reader just typed a password into. The domain has to stay a verified sender with
 * SPF, DKIM and DMARC, and the value is hardcoded because it is a product decision.
 */
export const MAIL_FROM: Address = { email: "no-reply@auth.sergiodxa.com", name: "Auth" };

/**
 * Mailbox replies go to, since {@link MAIL_FROM} is automated. Someone who answers a
 * security notice is answering about their account, and that reply has to reach a human.
 */
export const MAIL_REPLY_TO: Address = { email: "hello@sergiodxa.com" };
