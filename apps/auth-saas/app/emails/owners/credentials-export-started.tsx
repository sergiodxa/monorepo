/**
 * Tells a tenant owner that a credentials export just started: one request is about to carry
 * every stored password hash out of the platform, so the owners hear about it the moment it
 * begins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { AuthMailLayout } from "~/app/emails/layout";

export default createEmail(emails.owners.credentialsExportStarted, {
	subject: ({ tenantName, t }) => t("mail.credentialsExportStarted.subject", { tenantName }),
	body: (handle) => () => {
		let { t, tenantName } = handle.props;

		return (
			<AuthMailLayout
				title={t("mail.credentialsExportStarted.subject", { tenantName })}
				preview={t("mail.credentialsExportStarted.preview", { tenantName })}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.credentialsExportStarted.heading")}</Email.Heading>
				<Email.Text>{t("mail.credentialsExportStarted.body", { tenantName })}</Email.Text>
				<Email.Text muted>{t("mail.credentialsExportStarted.notice")}</Email.Text>
			</AuthMailLayout>
		);
	},
	preview: () => ({ tenantName: "Acme" }),
});
