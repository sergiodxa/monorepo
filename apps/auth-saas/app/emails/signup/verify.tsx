/**
 * Asks a fresh platform signup to confirm the address it claims, with a link carrying the
 * single-use ticket `addIdentifier` minted for it. It carries no other account fact, so an
 * interceptor learns only that a signup is pending for the address it names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { AuthMailLayout } from "~/app/emails/layout";

/** The platform's own display name, the same one its landing page and document title carry. */
const PLATFORM_NAME = "Auth SaaS";

export default createEmail(emails.signup.verify, {
	subject: ({ t }) => t("mail.platformSignupVerify.subject", { tenantName: PLATFORM_NAME }),
	body: (handle) => () => {
		let { t, url } = handle.props;

		return (
			<AuthMailLayout
				title={t("mail.platformSignupVerify.subject", { tenantName: PLATFORM_NAME })}
				preview={t("mail.platformSignupVerify.preview")}
				tenantName={PLATFORM_NAME}
				t={t}
			>
				<Email.Heading>{t("mail.platformSignupVerify.heading")}</Email.Heading>
				<Email.Text>
					{t("mail.platformSignupVerify.body", { tenantName: PLATFORM_NAME })}
				</Email.Text>
				<Email.Button href={url}>{t("mail.platformSignupVerify.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text muted>{t("mail.platformSignupVerify.unexpected")}</Email.Text>
			</AuthMailLayout>
		);
	},
	preview: () => ({ url: "https://auth.example.com/signup/verify?ticket=sample" }),
});
