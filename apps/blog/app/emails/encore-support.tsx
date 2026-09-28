/**
 * The email a support request becomes: addressed to the configured support inbox, with the
 * visitor as Reply-To so answering it from any mail client reaches them directly, and every
 * submitted field laid out as a fact table above the message itself. A request the spam filter
 * was unsure about arrives flagged, with the signals behind the doubt.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { SpamFilter } from "@sdxc/spam";
import type { Handle } from "remix/ui";

import { Email } from "@sdxc/mail";

import type { SupportRequest } from "~/app/schemas/encore-support";

/** Shown in place of an optional field the visitor left blank, so the table keeps its rows. */
const NOT_PROVIDED = "Not provided";

/**
 * The request body: its facts, then the message split into paragraphs on blank lines and
 * into lines on single breaks, so the visitor's own formatting survives into the inbox. A
 * flagged request lists the spam signals first, so the doubt is read before the message.
 */
function SupportRequestBody(
	handle: Handle<{ request: SupportRequest; flagged: SpamFilter.Assessment | undefined }>,
) {
	return () => {
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
	};
}

/**
 * One support request, ready for `mailer.send()`. The subject leads with the topic so an
 * inbox sorts bug reports from questions at a glance, after a `[Possible spam]` tag when the
 * spam filter was unsure.
 */
export class EncoreSupportEmail implements EmailContract {
	/**
	 * @param inbox The support inbox the request is delivered to.
	 * @param request The validated submission.
	 * @param flagged The spam assessment, when the filter was unsure and the email should say so.
	 */
	constructor(
		private inbox: string,
		private request: SupportRequest,
		private flagged?: SpamFilter.Assessment,
	) {}

	/** The configured support inbox. */
	get to(): Address {
		return { email: this.inbox };
	}

	/** The visitor, so a reply goes straight back to whoever asked. */
	get replyTo(): Address {
		let { email, name } = this.request;
		return name ? { email, name } : { email };
	}

	/** `[Encore] <topic> on <device>`, which reads as a triage label in an inbox list. */
	get subject(): string {
		let subject = `[Encore] ${this.request.topic} on ${this.request.platform}`;
		return this.flagged ? `[Possible spam] ${subject}` : subject;
	}

	/** Renders the request's facts and message, after the spam signals when flagged. */
	body() {
		return <SupportRequestBody request={this.request} flagged={this.flagged} />;
	}
}
