/**
 * The board's email: the registry mapping every declared email onto its template, and a
 * transport that keeps every message in memory. The app runs on a laptop with no inbox behind
 * it, so the captured messages are the delivery: `/outbox` reads {@link outbox}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createMail, lazy } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";

import emails from "~/app/emails";
import { translate } from "~/app/initializers/i18n";

/** Every message the board has sent, oldest first, for the whole life of the worker. */
export const outbox = new MemoryTransport();

/** The registry the job dispatcher's mailer renders declared emails through. */
export const mail = createMail({ translator: translate });

mail.map(
	emails.postingPublished,
	lazy(() => import("~/app/emails/posting-published")),
);

declare module "@sdxc/mail" {
	/** Types the `t()` every template receives with the keys of the board's message bundles. */
	interface MailTypes {
		translate: ReturnType<typeof translate>["t"];
	}
}
