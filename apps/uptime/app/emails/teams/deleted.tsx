/**
 * The notice a team's other members get when the team is destroyed by its owner's account
 * deletion: the team is gone, why, what went with it, and what they can do instead. It names
 * only the team, since the departed owner's identity and address are being erased.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

export default createEmail(emails.teams.deleted, {
	subject: ({ team, t }) => t("emails.teamDeleted.subject", { team }),
	/**
	 * Three paragraphs — what happened, what it means, what to do — so the data-loss warning
	 * stands on its own line for a skimmer reading the plain-text alternative. Starting a team
	 * of their own is the only next step, so the body carries no link.
	 */
	body: (handle) => () => {
		let { t, locale, team } = handle.props;

		return (
			<Email.Layout
				lang={locale}
				title={t("emails.teamDeleted.heading", { team })}
				preview={t("emails.teamDeleted.preview", { team })}
			>
				<Email.Heading>{t("emails.teamDeleted.heading", { team })}</Email.Heading>
				<Email.Text>{t("emails.teamDeleted.body", { team })}</Email.Text>
				<Email.Text>{t("emails.teamDeleted.lost")}</Email.Text>
				<Email.Text>{t("emails.teamDeleted.next")}</Email.Text>
				<Email.Footer>{t("emails.teamDeleted.footer", { team })}</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({ team: "Acme" }),
});
