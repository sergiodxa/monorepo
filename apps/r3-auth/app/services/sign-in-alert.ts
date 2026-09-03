/**
 * Dispatch of the new-sign-in notice: reads the subject the session was opened for,
 * reduces the request's user-agent and address to the labels the notice reports, and
 * queues the message for after the response.
 *
 * Kept as one module so every login controller shares it: a sign-in that mails
 * nobody is invisible, and drift between call sites is how one of them quietly
 * stops mailing. Every step here runs inside a `try`, with the send deferred and
 * both outcomes reported through the logger, so nothing here can fail a sign-in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";

import Subject from "~/app/data/subject";
import { DEFAULT_EMAIL_LOCALE } from "~/app/emails/locale";
import { NewSignInEmail } from "~/app/emails/new-sign-in";
import { parseUserAgent } from "~/app/http/view-models/account-session";

/**
 * The copy stays in {@link DEFAULT_EMAIL_LOCALE}, since its reader may be a
 * stranger to the sign-in. The log carries only the subject id: the address is
 * the person, and the session id is a refresh token.
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

		ctx.logger.info("sign_in_alert_queued", { subjectId });
	} catch (error) {
		ctx.logger.error("sign_in_alert_failed", {
			subjectId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
}
