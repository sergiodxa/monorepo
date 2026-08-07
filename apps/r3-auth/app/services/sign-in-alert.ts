/**
 * Dispatch of the new-sign-in notice: reads the subject the session was opened for,
 * reduces the request's user-agent and address to the labels the notice reports, and
 * queues the message for after the response.
 *
 * It is one module rather than a few lines in each login controller because a sign-in
 * that mails nobody is invisible, and two call sites drifting apart is how one of them
 * ends up being the one that stopped. Nothing here can fail a sign-in: every step is
 * inside a `try`, the send itself is deferred, and both report through the logger.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/fetch-router";

import { getClientIP } from "@pkg/get-client-ip";

import Subject from "~/app/data/subject";
import { DEFAULT_EMAIL_LOCALE } from "~/app/emails/locale";
import { NewSignInEmail } from "~/app/emails/new-sign-in";
import { parseUserAgent } from "~/app/http/view-models/account-session";

/**
 * Queues the notice for a session that has just been opened.
 *
 * Deferred rather than awaited: the send is flushed after the response is produced, so a
 * refused delivery, an exhausted send quota or an unreachable provider cannot turn a
 * successful sign-in into an error page. Its failure is logged by the mail middleware.
 *
 * The device labels come from the same reduction the account area's device list renders,
 * so the notice and the page a reader is sent to describe the session in the same words.
 * A subject that cannot be read is logged and skipped: there is nowhere to send a notice
 * about an account whose address could not be loaded.
 *
 * The copy is pinned to {@link DEFAULT_EMAIL_LOCALE} rather than following the request's
 * language. This is the one message whose reader may not be the person who made the
 * request — that is the entire reason it is sent — so honouring the signing-in browser's
 * `Accept-Language` would let a stranger choose the language a warning about them is
 * written in. Subjects carry no stored preference, so the app's own language is what is
 * actually known about the reader.
 *
 * @param ctx - The request the sign-in arrived on; its mailer, logger, user-agent and
 *   client address are all read from it.
 * @param db - Database the subject's address is read from.
 * @param subjectId - Subject the session was opened for.
 */
export async function notifyNewSignIn(
	ctx: RequestContext,
	db: Database,
	subjectId: string,
): Promise<void> {
	try {
		let subject = await Subject.findById(db, subjectId);
		if (!subject) {
			ctx.logger.error("sign_in_alert_subject_missing", { subjectId });
			return;
		}

		let ua = parseUserAgent(ctx.request.headers.get("user-agent"));

		ctx.email.later(
			new NewSignInEmail({
				email: subject.email_address,
				browser: ua.browser,
				os: ua.os,
				deviceType: ua.deviceType,
				ip: getClientIP(ctx.request),
				locale: DEFAULT_EMAIL_LOCALE,
				t: ctx.i18next.getFixedT(DEFAULT_EMAIL_LOCALE),
			}),
		);

		// The subject id only. The address is the person, and the session's id is the
		// refresh token; neither belongs in a log line.
		ctx.logger.info("sign_in_alert_queued", { subjectId });
	} catch (error) {
		ctx.logger.error("sign_in_alert_failed", {
			subjectId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}
