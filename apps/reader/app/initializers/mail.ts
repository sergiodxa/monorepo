/**
 * The email registry: every email `app/emails/index.ts` declares, mapped onto its template
 * through `lazy()`, so a send imports only the template it renders. It holds no transport;
 * the reader's object builds its mailer over the deployment's own binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createMail, lazy } from "@sdxc/mail";

import emails from "~/app/emails";
import { translate } from "~/app/initializers/i18n";

/** The registry every mailer the app builds renders declared emails through. */
export const mail = createMail({ translator: translate });

mail.map(
	emails.notification,
	lazy(() => import("~/app/emails/notification")),
);

declare module "@sdxc/mail" {
	/** Types the `t()` every template receives with the keys of the app's dictionaries. */
	interface MailTypes {
		translate: ReturnType<typeof translate>["t"];
	}
}
