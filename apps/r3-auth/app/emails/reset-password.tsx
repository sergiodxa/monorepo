/**
 * The message that carries a password-recovery link: one action, the window it is good
 * for, and a line saying an unrequested copy is safe to ignore.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";

/**
 * Offers a subject a way back into their account. The deadline is a duration, which a
 * reader in any time zone can act on directly, and the plain link is repeated under the
 * button for clients that strip it and readers who check where a link goes.
 */
export default createEmail(emails.resetPassword, {
	subject: ({ t }) => t("emails.resetPassword.subject"),
	body: (handle) => () => {
		let { t, locale, url, minutes } = handle.props;

		return (
			<EmailLayout
				lang={locale}
				t={t}
				title={t("emails.resetPassword.heading")}
				preview={t("emails.resetPassword.preview")}
			>
				<Email.Heading>{t("emails.resetPassword.heading")}</Email.Heading>
				<Email.Text>{t("emails.resetPassword.body")}</Email.Text>
				<Email.Button href={url} background={ACTION_BACKGROUND}>
					{t("emails.resetPassword.action")}
				</Email.Button>
				<Email.Text muted>{t("emails.resetPassword.expiry", { minutes })}</Email.Text>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text muted>{t("emails.resetPassword.unexpected")}</Email.Text>
			</EmailLayout>
		);
	},
	preview: () => ({ url: "https://auth.sergiodxa.com/password/reset?token=preview", minutes: 30 }),
});
