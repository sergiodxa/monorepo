/**
 * Asks a subject to confirm the address their account claims, with a link carrying the
 * single-use ticket `addIdentifier` minted for it. It carries no other account fact, so an
 * interceptor learns only that a signup or an address change is pending for the address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { AuthMailLayout } from "~/app/emails/layout";

export default createEmail(emails.verifyAddress, {
	subject: ({ tenantName, t }) => t("mail.verifyAddress.subject", { tenantName }),
	body: (handle) => () => {
		let { t, url, tenantName } = handle.props;

		return (
			<AuthMailLayout
				title={t("mail.verifyAddress.subject", { tenantName })}
				preview={t("mail.verifyAddress.preview")}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.verifyAddress.heading")}</Email.Heading>
				<Email.Text>{t("mail.verifyAddress.body", { tenantName })}</Email.Text>
				<Email.Button href={url}>{t("mail.verifyAddress.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
			</AuthMailLayout>
		);
	},
	preview: () => ({ url: "https://acme.example.com/u/verify?ticket=sample", tenantName: "Acme" }),
});
