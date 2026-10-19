/**
 * The email a team admin's invite produces, addressed to the invitee it names. The reader has
 * no stored preference yet, so the sender passes no locale and the copy is written in the
 * app's fallback language, independently of the language the admin browses in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

export default createEmail(emails.teams.invite, {
	subject: ({ team, t }) => t("emails.teamInvite.subject", { team }),
	/** The accept link is a real anchor so it survives into the plain-text alternative. */
	body: (handle) => () => {
		let { t, locale, team, url } = handle.props;

		return (
			<Email.Layout
				lang={locale}
				title={t("emails.teamInvite.heading", { team })}
				preview={t("emails.teamInvite.preview", { team })}
			>
				<Email.Heading>{t("emails.teamInvite.heading", { team })}</Email.Heading>
				<Email.Text>{t("emails.teamInvite.body", { team })}</Email.Text>
				<Email.Button href={url}>{t("emails.teamInvite.action")}</Email.Button>
				<Email.Footer>{t("emails.teamInvite.footer")}</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({ team: "Acme", url: "https://uptime.sergiodxa.com/invite/abc-123" }),
});
