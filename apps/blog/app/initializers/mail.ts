/**
 * The email registry: every email `app/emails/index.ts` declares, mapped onto its template
 * through `lazy()`, so a send imports only the template it renders. Every email goes to the
 * site's own inboxes and is written in English, so the registry has no translator.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createMail, lazy } from "@sdxc/mail";

import emails from "~/app/emails";

/** The registry the job dispatcher's mailer and the support desk render declared emails through. */
export const mail = createMail();

mail.map(
	emails.bookmarks.digest,
	lazy(() => import("~/app/emails/bookmarks/digest")),
);
mail.map(
	emails.encore.support,
	lazy(() => import("~/app/emails/encore/support")),
);
mail.map(
	emails.press.contact,
	lazy(() => import("~/app/emails/press/contact")),
);
