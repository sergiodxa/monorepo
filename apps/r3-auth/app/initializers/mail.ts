/**
 * The email registry: every email `app/emails/index.ts` declares, mapped onto its template
 * through `lazy()`, so a send imports only the template it renders. It holds no transport, so
 * the Worker's mailers and the command line share it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createMail, lazy } from "@sdxc/mail";

import emails from "~/app/emails";
import { translate } from "~/app/initializers/i18n";

/** The registry the router, the job dispatcher and the command line hand their mailers. */
export const mail = createMail({ translator: translate });

mail.map(
	emails.newSignIn,
	lazy(() => import("~/app/emails/new-sign-in")),
);
mail.map(
	emails.passwordChanged,
	lazy(() => import("~/app/emails/password-changed")),
);
mail.map(
	emails.resetPassword,
	lazy(() => import("~/app/emails/reset-password")),
);
mail.map(
	emails.verifyEmail,
	lazy(() => import("~/app/emails/verify-email")),
);

declare module "@sdxc/mail" {
	/** Types the `t()` every template receives with the keys of the app's message bundles. */
	interface MailTypes {
		translate: ReturnType<typeof translate>["t"];
	}
}
