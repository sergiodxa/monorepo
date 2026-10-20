/**
 * The notice a subject receives once their password has been changed through a recovery
 * link, and every session on the account has been ended.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";
import { ISSUER_HOST } from "~/config/oidc";
import routes from "~/routes/web";

/**
 * Absolute URL of the sign-in entry point. Built from the typed route so it tracks the
 * route table, and against the published issuer host because mail needs an absolute href.
 * Following it only offers the ways in this server already offers.
 */
function signInUrl(): string {
	return new URL(routes.authorize.index.href(), ISSUER_HOST).toString();
}

/**
 * Tells a subject that their password was changed and their sessions were ended. The
 * sign-out is reported as well as the change, because it is the part a reader notices on
 * their other devices and an unexplained sign-out reads as a fault.
 */
export default createEmail(emails.passwordChanged, {
	subject: ({ t }) => t("emails.passwordChanged.subject"),
	body: (handle) => () => {
		let { t, locale } = handle.props;

		return (
			<EmailLayout
				lang={locale}
				t={t}
				title={t("emails.passwordChanged.heading")}
				preview={t("emails.passwordChanged.preview")}
			>
				<Email.Heading>{t("emails.passwordChanged.heading")}</Email.Heading>
				<Email.Text>{t("emails.passwordChanged.body")}</Email.Text>
				<Email.Text>{t("emails.passwordChanged.sessions")}</Email.Text>
				<Email.Button href={signInUrl()} background={ACTION_BACKGROUND}>
					{t("emails.passwordChanged.action")}
				</Email.Button>
				<Email.Text muted>{t("emails.passwordChanged.unexpected")}</Email.Text>
			</EmailLayout>
		);
	},
	preview: () => ({}),
});
