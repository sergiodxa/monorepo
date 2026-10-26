/**
 * The email an invitation from the press kit becomes: addressed to the author, with the
 * organizer as Reply-To so answering it from any mail client reaches them directly, and the
 * invitation's facts laid out above the message itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

/** Shown in place of the event when the organizer left it blank, so the table keeps its row. */
const NOT_PROVIDED = "Not provided";

/**
 * The invitation's facts, then the message split into paragraphs on blank lines and into lines
 * on single breaks, so the organizer's own formatting survives into the inbox. A flagged
 * invitation lists the spam signals first, so the doubt is read before the message.
 */
export default createEmail(emails.press.contact, {
	/** `[Press] <kind>: <event or name>`, after `[Possible spam]` when the filter was unsure. */
	subject: ({ request, flagged }) => {
		let subject = `[Press] ${request.kind}: ${request.event || request.name}`;
		return flagged ? `[Possible spam] ${subject}` : subject;
	},
	/** The organizer, so a reply goes straight back to whoever wrote. */
	replyTo: ({ request }) => ({ email: request.email, name: request.name }),
	body: (handle) => () => {
		let { request, pageLanguage, flagged } = handle.props;
		let paragraphs = request.message.split(/\n\s*\n/);

		return (
			<Email.Layout title="Press kit invitation" preview={`${request.kind} from ${request.name}`}>
				<Email.Heading>Press kit invitation</Email.Heading>
				{flagged ? (
					<>
						<Email.Text>
							This message may be spam (score {flagged.score}). Check it before replying.
						</Email.Text>
						<Email.Table
							rows={flagged.signals.map((signal) => ({
								label: signal.check,
								value: signal.detail ? `${signal.score}: ${signal.detail}` : String(signal.score),
							}))}
						/>
					</>
				) : null}
				<Email.Table
					rows={[
						{ label: "Kind", value: request.kind },
						{ label: "Event", value: request.event || NOT_PROVIDED },
						{ label: "Name", value: request.name },
						{ label: "Email", value: request.email },
						{ label: "Page language", value: pageLanguage },
					]}
				/>
				<Email.Heading level={2}>Message</Email.Heading>
				{paragraphs.map((paragraph) => (
					<Email.Text>
						{paragraph
							.split("\n")
							.flatMap((line, index) => (index === 0 ? [line] : [<br />, line]))}
					</Email.Text>
				))}
				<Email.Footer>
					Sent from the press kit at sergiodxa.com/press. Reply to this email to answer the sender.
				</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		request: {
			name: "Ada Lovelace",
			email: "ada@example.com",
			kind: "conference",
			event: "Remix Jam 2027",
			message: "Would you give a talk at Remix Jam?\n\nWe cover travel and lodging.",
		},
		pageLanguage: "en",
	}),
});
