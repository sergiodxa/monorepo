/**
 * Carries an invitation to administer a tenant's dashboard: the tenant's name, the role
 * offered, and a link to accept it. The link points at the dashboard's accept page on the
 * platform domain, which the accept endpoint resolves once that dashboard exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { AuthMailLayout } from "~/app/emails/layout";

export default createEmail(emails.tenants.invitation, {
	subject: ({ tenantName, t }) => t("mail.tenantInvitation.subject", { tenantName }),
	body: (handle) => () => {
		let { t, url, tenantName, role } = handle.props;

		return (
			<AuthMailLayout
				title={t("mail.tenantInvitation.subject", { tenantName })}
				preview={t("mail.tenantInvitation.preview", { tenantName })}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.tenantInvitation.heading")}</Email.Heading>
				<Email.Text>{t("mail.tenantInvitation.body", { tenantName, role })}</Email.Text>
				<Email.Button href={url}>{t("mail.tenantInvitation.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text muted>{t("mail.tenantInvitation.unexpected")}</Email.Text>
			</AuthMailLayout>
		);
	},
	preview: () => ({
		tenantName: "Acme",
		role: "admin" as const,
		url: "https://dashboard.auth.example.com/invitations/accept?token=sample",
	}),
});
