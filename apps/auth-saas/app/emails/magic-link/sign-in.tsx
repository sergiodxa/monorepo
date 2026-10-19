/**
 * Carries a magic-link sign-in's two secrets: the link, whose `GET` consumes nothing, and the
 * code beside it for the browser that asked when the email is read on another device. It
 * reaches only the address `beginMagicLinkSignIn` resolved to a subject, never the input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { AuthMailLayout } from "~/app/emails/layout";

export default createEmail(emails.magicLink.signIn, {
	subject: ({ tenantName, t }) => t("mail.magicLinkSignIn.subject", { tenantName }),
	body: (handle) => () => {
		let { t, url, code, tenantName } = handle.props;

		return (
			<AuthMailLayout
				title={t("mail.magicLinkSignIn.subject", { tenantName })}
				preview={t("mail.magicLinkSignIn.preview")}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.magicLinkSignIn.heading", { tenantName })}</Email.Heading>
				<Email.Text>{t("mail.magicLinkSignIn.body", { tenantName })}</Email.Text>
				<Email.Button href={url}>{t("mail.magicLinkSignIn.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text>
					{t("mail.magicLinkSignIn.codeIntro")} <Email.CodeInline>{code}</Email.CodeInline>
				</Email.Text>
				<Email.Text muted>{t("mail.magicLinkSignIn.unexpected")}</Email.Text>
			</AuthMailLayout>
		);
	},
	preview: () => ({
		url: "https://acme.example.com/u/magic-link/complete?token=sample",
		code: "ABCD-EFGH",
		tenantName: "Acme",
	}),
});
