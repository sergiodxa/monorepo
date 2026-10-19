/**
 * The email registry: every email `app/emails/index.ts` declares, mapped onto its template
 * through `lazy()`, so a send imports only the template it renders. It holds no transport, so
 * the Worker's mailers and the command line share it, each rendering in the reader's language.
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
	emails.alert,
	lazy(() => import("~/app/emails/alert")),
);
mail.map(
	emails.accountDeleted,
	lazy(() => import("~/app/emails/account-deleted")),
);
mail.map(
	emails.funnelReport,
	lazy(() => import("~/app/emails/funnel-report")),
);
mail.map(
	emails.teams.invite,
	lazy(() => import("~/app/emails/teams/invite")),
);
mail.map(
	emails.teams.deleted,
	lazy(() => import("~/app/emails/teams/deleted")),
);
mail.map(
	emails.teams.dailyDigest,
	lazy(() => import("~/app/emails/teams/daily-digest")),
);
mail.map(
	emails.teams.weeklyDigest,
	lazy(() => import("~/app/emails/teams/weekly-digest")),
);
mail.map(
	emails.trial.confirmation,
	lazy(() => import("~/app/emails/trial/confirmation")),
);
mail.map(
	emails.trial.change,
	lazy(() => import("~/app/emails/trial/change")),
);
mail.map(
	emails.trial.repeatReport,
	lazy(() => import("~/app/emails/trial/repeat-report")),
);
mail.map(
	emails.trial.dailyDigest,
	lazy(() => import("~/app/emails/trial/daily-digest")),
);
mail.map(
	emails.trial.weeklyDigest,
	lazy(() => import("~/app/emails/trial/weekly-digest")),
);

declare module "@sdxc/mail" {
	/** Types the `t()` every template receives with the keys of the app's message bundles. */
	interface MailTypes {
		translate: ReturnType<typeof translate>["t"];
	}
}
