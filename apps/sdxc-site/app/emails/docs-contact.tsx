/**
 * The question a docs reader sends from the contact form, delivered to the author's inbox. It
 * names the reader, links the page they were reading and quotes their message; a reply goes
 * straight back to the reader, whose address the delivery sets as reply-to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

export default createEmail(emails.docsContact, {
	subject: ({ name, email }) => `[sdxc docs] Question from ${name || email}`,
	/** The reader and the page, then the message as they wrote it. */
	body: (handle) => () => {
		let { name, email, message, page } = handle.props;
		return (
			<Email.Layout title="Docs question" preview={message.slice(0, 120)}>
				<Email.Heading>Docs question</Email.Heading>
				<Email.Table
					rows={[
						{ label: "From", value: name ? `${name} <${email}>` : email },
						{
							label: "Page",
							value: page ? <Email.Link href={page}>{page}</Email.Link> : "Not given",
						},
					]}
				/>
				<Email.Text>{message}</Email.Text>
			</Email.Layout>
		);
	},
	preview: () => ({
		name: "Ada Lovelace",
		email: "ada@example.com",
		message: "How do I run a migration before the deploy step?",
		page: "https://sdxc.dev/docs/sdxc/deploy",
	}),
});
