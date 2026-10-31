/**
 * A support form submission, mailed to the support inbox with the sender as reply-to, so
 * answering it is replying to the email. It is read by support, so it is written in English.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

export default createEmail(emails.support, {
	subject: ({ topic, message }) =>
		`[Reader · ${topic}] ${message.split("\n")[0]?.slice(0, 80) ?? ""}`,
	/** Replying goes to the person who wrote, not back to the form. */
	replyTo: ({ email, name }) => ({ email, name: name || undefined }),
	body: (handle) => () => {
		let { email, message, name, page, signedIn, topic } = handle.props;
		let title = `Support request: ${topic}`;

		return (
			<Email.Layout lang="en" preview={message.slice(0, 120)} title={title}>
				<Email.Heading>{title}</Email.Heading>
				<Email.Text>
					From {name || "(no name)"} <Email.Link href={`mailto:${email}`}>{email}</Email.Link>,{" "}
					{signedIn ? "signed in" : "not signed in"}
					{page ? `, writing from the help page "${page}"` : ""}.
				</Email.Text>
				{message.split(/\n{2,}/).map((paragraph, index) => (
					<Email.Text key={index}>{paragraph}</Email.Text>
				))}
			</Email.Layout>
		);
	},
	preview: () => ({
		name: "Ada Lovelace",
		email: "ada@example.com",
		topic: "problem",
		page: "feed-not-updating",
		message:
			"My feed from example.com stopped updating three days ago.\n\nThe feed page says the site answered with an error.",
		signedIn: true,
	}),
});
