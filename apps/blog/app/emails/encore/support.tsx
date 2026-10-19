/**
 * The email a support request becomes: addressed to the configured support inbox, with the
 * visitor as Reply-To so answering it from any mail client reaches them directly, and every
 * submitted field laid out as a fact table above the message itself. A request the spam filter
 * was unsure about arrives flagged, with the signals behind the doubt.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

/** Shown in place of an optional field the visitor left blank, so the table keeps its rows. */
const NOT_PROVIDED = "Not provided";

/**
 * The request's facts, then the message split into paragraphs on blank lines and into lines
 * on single breaks, so the visitor's own formatting survives into the inbox. A flagged request
 * lists the spam signals first, so the doubt is read before the message.
 */
export default createEmail(emails.encore.support, {
	/** `[Encore] <topic> on <device>`, after `[Possible spam]` when the filter was unsure. */
	subject: ({ request, flagged }) => {
		let subject = `[Encore] ${request.topic} on ${request.platform}`;
		return flagged ? `[Possible spam] ${subject}` : subject;
	},
	/** The visitor, so a reply goes straight back to whoever asked. */
	replyTo: ({ request }) =>
		request.name ? { email: request.email, name: request.name } : { email: request.email },
	body: (handle) => () => {
		let { request, flagged } = handle.props;
		let paragraphs = request.message.split(/\n\s*\n/);

		return (
			<Email.Layout
				title="Encore support request"
				preview={`${request.topic} from ${request.email}`}
			>
				<Email.Heading>Encore support request</Email.Heading>
				{flagged ? (
					<>
						<Email.Text>
							This request may be spam (score {flagged.score}). Check it before replying.
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
						{ label: "Topic", value: request.topic },
						{ label: "Name", value: request.name || NOT_PROVIDED },
						{ label: "Email", value: request.email },
						{ label: "Device", value: request.platform },
						{ label: "OS version", value: request.osVersion || NOT_PROVIDED },
						{ label: "App version", value: request.appVersion || NOT_PROVIDED },
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
					Sent from the support form at sergiodxa.com/apps/encore/support. Reply to this email to
					answer the sender.
				</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		request: {
			name: "Ada Lovelace",
			email: "ada@example.com",
			topic: "Bug report",
			platform: "iPhone",
			osVersion: "26.0",
			appVersion: "1.4",
			message: "The timer stops when the screen locks.\n\nIt happens every time.",
		},
	}),
});
