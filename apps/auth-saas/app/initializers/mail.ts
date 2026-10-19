/**
 * The email registry: every email `app/emails/index.ts` declares, mapped onto its template
 * through `lazy()`, so a send imports only the template it renders. It holds no transport, so
 * every router, the job dispatcher and a test share it.
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
	emails.verifyAddress,
	lazy(() => import("~/app/emails/verify-address")),
);
mail.map(
	emails.resetPassword,
	lazy(() => import("~/app/emails/reset-password")),
);
mail.map(
	emails.magicLink.signIn,
	lazy(() => import("~/app/emails/magic-link/sign-in")),
);
mail.map(
	emails.magicLink.noAccount,
	lazy(() => import("~/app/emails/magic-link/no-account")),
);
mail.map(
	emails.signup.verify,
	lazy(() => import("~/app/emails/signup/verify")),
);
mail.map(
	emails.tenants.invitation,
	lazy(() => import("~/app/emails/tenants/invitation")),
);
mail.map(
	emails.owners.attackSignal,
	lazy(() => import("~/app/emails/owners/attack-signal")),
);
mail.map(
	emails.owners.credentialsExportStarted,
	lazy(() => import("~/app/emails/owners/credentials-export-started")),
);

declare module "@sdxc/mail" {
	/** Types the `t()` every template receives with the keys of the app's message bundle. */
	interface MailTypes {
		translate: ReturnType<typeof translate>["t"];
	}
}
