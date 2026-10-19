/**
 * Asks a subject to confirm the address their account is registered under, with a
 * button carrying a single-use token and the minutes it lasts, and no other account
 * facts; the caller builds the link and the lifetime it quotes, so the two agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";

/**
 * Asks a subject to confirm the address on their account. The lifetime sits beside the
 * button so a reader who returns to an expired link learns it has expired before clicking,
 * and that same line tells them where a fresh one comes from.
 */
export default createEmail(emails.verifyEmail, {
	subject: ({ t }) => t("emails.verifyEmail.subject"),
	body: (handle) => () => {
		let { t, locale, url, expiresInMinutes } = handle.props;

		return (
			<EmailLayout
				lang={locale}
				t={t}
				title={t("emails.verifyEmail.heading")}
				preview={t("emails.verifyEmail.preview")}
			>
				<Email.Heading>{t("emails.verifyEmail.heading")}</Email.Heading>
				<Email.Text>{t("emails.verifyEmail.body")}</Email.Text>
				<Email.Button href={url} background={ACTION_BACKGROUND}>
					{t("emails.verifyEmail.action")}
				</Email.Button>
				<Email.Text muted>
					{t("emails.verifyEmail.expiry", { minutes: expiresInMinutes })}
				</Email.Text>
				<Email.Text muted>{t("emails.verifyEmail.ignore")}</Email.Text>
			</EmailLayout>
		);
	},
	preview: () => ({
		url: "https://auth.sergiodxa.com/verify-email?token=preview",
		expiresInMinutes: 30,
	}),
});
