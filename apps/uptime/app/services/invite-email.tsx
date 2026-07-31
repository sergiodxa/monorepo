/**
 * Sends the team-invite email. Renders the remix/ui email body to an HTML string
 * (Resend's SDK only renders React trees itself, and this app doesn't use React) and
 * fires the send without blocking the caller — a failed invite email shouldn't fail
 * the invite itself, so the send is fire-and-forget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { Resend } from "resend";

import { recordCost } from "~/app/services/cost";
import TeamInviteEmail from "~/resources/views/emails/team-invite";

const EMAIL_FROM = "Uptime <no-reply@uptime.sergiodxa.com>";
const EMAIL_REPLY_TO = "hello@sergiodxa.com";

/** Sends the invite email for a pending invite. */
export async function sendInviteEmail(
	resend: Resend,
	teamName: string,
	email: string,
	url: string,
) {
	let html = await renderToString(<TeamInviteEmail team={teamName} url={url} />);

	// Counted before the send: a rejected send is a billed one.
	recordCost("emailSent");

	await resend.emails.send({
		from: EMAIL_FROM,
		replyTo: EMAIL_REPLY_TO,
		to: email,
		subject: `You've been invited to join ${teamName} on Uptime`,
		html,
	});
}
