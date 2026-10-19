/**
 * The mailbox the worker's jobs send from, on the domain verified for the `EMAIL` binding,
 * so a provider accepts the message as the site's own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address } from "@sdxc/mail";

/** Sender of the bookmarks digest, the one email a job sends. */
export const MAIL_FROM: Address = { email: "bookmarks@support.sergiodxa.com", name: "Bookmarks" };
