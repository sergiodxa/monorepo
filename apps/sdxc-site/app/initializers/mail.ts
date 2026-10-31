/**
 * The email registry: every email `app/emails/index.ts` declares, mapped onto its template
 * through `lazy()`, so a send imports only the template it renders. It holds no transport, so
 * a test hands it a mailer of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createMail, lazy } from "@sdxc/mail";

import emails from "~/app/emails";

/** The registry the contact route's mailer renders declared emails through; copy is English. */
export const mail = createMail();

mail.map(
	emails.docsContact,
	lazy(() => import("~/app/emails/docs-contact")),
);
