/**
 * `POST /account/verify-email/resend` — mails a fresh verification link to the signed-in
 * subject's own address, so nobody whose message was lost, deleted or never delivered is
 * stuck with an unverifiable account.
 *
 * It takes no address: the recipient is whoever the session guard resolved, which is what
 * keeps this from being a mailer anybody can point at a stranger. It is subject to the
 * same per-address window every other send is, and needs no rate limiter of its own for
 * mail volume — the window bounds sends per address, and the guard bounds this endpoint to
 * one address per session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import requireSubject from "~/app/http/middleware/require-subject";
import { RESEND_OUTCOME_PARAM } from "~/app/http/view-models/email-verification";
import { sendVerificationEmail } from "~/app/services/email-verification";
import routes from "~/routes/web";

export default createAction(routes.account.verifyEmailResend, {
	middleware: [requireSubject],
	/**
	 * Attempts the send and redirects back to the profile, naming the outcome in the query
	 * so the page can report it.
	 *
	 * The outcome is carried in the URL rather than in the session because it is one
	 * sentence about the request that just happened, and a value written to a shared session
	 * outlives the page it was meant for. It names an outcome and nothing else — no token,
	 * no address — so it is safe in a history entry.
	 */
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();

		let outcome = await sendVerificationEmail(ctx, db, ctx.subject.id);

		ctx.logger.info("email_verification_resend_requested", {
			subjectId: ctx.subject.id,
			outcome,
		});

		let location = new URL(routes.account.profile.href(), ctx.url.origin);
		location.searchParams.set(RESEND_OUTCOME_PARAM, outcome);

		return redirect(`${location.pathname}${location.search}`, {
			status: redirect.Status.SeeOther,
		});
	}),
});
