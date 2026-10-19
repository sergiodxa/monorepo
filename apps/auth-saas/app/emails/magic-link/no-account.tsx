/**
 * Tells an address's owner that a magic-link sign-in was attempted against it and no account
 * exists, so the uniform page every request renders stays honest. It carries neither a token
 * nor a code, since nothing was minted that this email could authorize.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { AuthMailLayout } from "~/app/emails/layout";

export default createEmail(emails.magicLink.noAccount, {
	subject: ({ tenantName, t }) => t("mail.magicLinkNoAccount.subject", { tenantName }),
	body: (handle) => () => {
		let { t, tenantName } = handle.props;

		return (
			<AuthMailLayout
				title={t("mail.magicLinkNoAccount.subject", { tenantName })}
				preview={t("mail.magicLinkNoAccount.preview")}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.magicLinkNoAccount.heading")}</Email.Heading>
				<Email.Text>{t("mail.magicLinkNoAccount.body", { tenantName })}</Email.Text>
				<Email.Text muted>{t("mail.magicLinkNoAccount.notice")}</Email.Text>
			</AuthMailLayout>
		);
	},
	preview: () => ({ tenantName: "Acme" }),
});
