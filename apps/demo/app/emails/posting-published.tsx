/**
 * The confirmation a poster receives once their position is live. It is the board's only
 * message, and the one the `/outbox` page renders, so it states what was published and
 * when it closes rather than only that something happened.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

export default createEmail(emails.postingPublished, {
	subject: ({ title, t }) => t("email.subject", { title }),
	body: (handle) => () => {
		let { company, locale, t, title } = handle.props;
		let heading = t("email.heading");

		return (
			<Email.Layout lang={locale} preview={heading} title={heading}>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>{t("email.body", { title, company })}</Email.Text>
				<Email.Footer>{t("email.footer")}</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({ title: "Senior Remix Engineer", company: "Acme" }),
});
