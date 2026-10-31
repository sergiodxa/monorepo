/**
 * The question a docs reader sends from the contact form, delivered to the support inbox.
 * It names the reader, the page they were on and their message; replying to it writes
 * straight back to the reader, whose address the delivery sets as reply-to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

/** The inbox reads English whatever language the reader browsed the docs in. */
const SUPPORT_LOCALE = "en";

export default createEmail(emails.docsContact, {
	subject: ({ name, email }) => `[Uptime docs] Question from ${name || email}`,
	/** The reader and the page, then the message as they wrote it. */
	body: (handle) => () => {
		let { name, email, message, page } = handle.props;
		return (
			<Email.Layout lang={SUPPORT_LOCALE} title="Docs question" preview={message.slice(0, 120)}>
				<Email.Heading>Docs question</Email.Heading>
				<Email.Table
					rows={[
						{ label: "From", value: name ? `${name} <${email}>` : email },
						{ label: "Page", value: page || "not given" },
					]}
				/>
				<Email.Text>{message}</Email.Text>
			</Email.Layout>
		);
	},
	preview: () => ({
		name: "Ada Lovelace",
		email: "ada@example.com",
		message: "My cron job shows as missed even though it ran. What am I missing?",
		page: "https://uptime.sergiodxa.com/docs/troubleshooting/cron-job-missed",
	}),
});
