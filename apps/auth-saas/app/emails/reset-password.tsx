/**
 * Carries a password-recovery link: one action and nothing else, since this is the one email
 * holding a credential. It reaches only the address `beginPasswordReset` resolved, never the
 * identifier as typed, so an interceptor learns just the address a reset is pending for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { AuthMailLayout } from "~/app/emails/layout";

export default createEmail(emails.resetPassword, {
	subject: ({ tenantName, t }) => t("mail.resetPassword.subject", { tenantName }),
	body: (handle) => () => {
		let { t, url, tenantName } = handle.props;

		return (
			<AuthMailLayout
				title={t("mail.resetPassword.subject", { tenantName })}
				preview={t("mail.resetPassword.preview")}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.resetPassword.heading")}</Email.Heading>
				<Email.Text>{t("mail.resetPassword.body", { tenantName })}</Email.Text>
				<Email.Button href={url}>{t("mail.resetPassword.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text muted>{t("mail.resetPassword.unexpected")}</Email.Text>
			</AuthMailLayout>
		);
	},
	preview: () => ({ url: "https://acme.example.com/u/reset?ticket=sample", tenantName: "Acme" }),
});
