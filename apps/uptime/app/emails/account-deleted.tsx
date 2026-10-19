/**
 * Confirmation, after the fact, that the account deletion asked for has happened. The daily
 * sweep sends it just before deleting the queued request row, the only place the address was
 * still held, so it carries that confirmation and an honest account of what is retained.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

export default createEmail(emails.accountDeleted, {
	subject: ({ t }) => t("emails.accountDeleted.subject"),
	/**
	 * Each retention note is its own `Text`, so each one survives the plain-text conversion as
	 * its own paragraph, since that part is where many readers see the message.
	 */
	body: (handle) => () => {
		let { t, locale } = handle.props;

		return (
			<Email.Layout
				lang={locale}
				title={t("emails.accountDeleted.heading")}
				preview={t("emails.accountDeleted.preview")}
			>
				<Email.Heading>{t("emails.accountDeleted.heading")}</Email.Heading>
				<Email.Text>{t("emails.accountDeleted.body")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.intro")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.billing")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.analytics")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.logs")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.identity")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.address")}</Email.Text>
				<Email.Footer>{t("emails.accountDeleted.footer")}</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({}),
});
