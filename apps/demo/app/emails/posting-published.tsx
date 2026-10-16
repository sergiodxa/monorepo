/**
 * The confirmation a poster receives once their position is live. It is the board's only
 * message, and the one the `/outbox` page renders, so it states what was published and
 * when it closes rather than only that something happened.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineEmail, Email } from "@sdxc/mail";

/** What the confirmation says, in the language the submission was made in. */
export interface PostingPublishedCopy {
	subject: string;
	heading: string;
	body: string;
	footer: string;
}

/** The confirmation sent to the address a posting listed as its contact. */
export const PostingPublishedEmail = defineEmail<PostingPublishedCopy>({
	subject: (copy) => copy.subject,
	body: (handle) => () => {
		let { body, footer, heading } = handle.props;

		return (
			<Email.Layout preview={heading} title={heading}>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>{body}</Email.Text>
				<Email.Footer>{footer}</Email.Footer>
			</Email.Layout>
		);
	},
});
