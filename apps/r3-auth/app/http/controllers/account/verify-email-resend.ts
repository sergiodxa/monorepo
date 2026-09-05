/**
 * `POST /account/verify-email/resend` — mails a fresh verification link to the signed-in
 * subject's own address, so anyone whose message went missing can still verify. The
 * recipient is whoever the session guard resolved, and the per-address send window
 * already bounds how often that one address can be mailed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { inject } from "@sdxc/service-container";
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
	 * Attempts the send and redirects to the profile, naming the outcome in the query so
	 * the page can report it. The query carries it because it describes the request that
	 * just happened and names an outcome alone, which is safe in a history entry.
	 */
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();

		let outcome = await sendVerificationEmail(ctx, db, ctx.subject.id);

		ctx.log.set({ email_verification: { outcome } });

		let location = new URL(routes.account.profile.href(), ctx.url.origin);
		location.searchParams.set(RESEND_OUTCOME_PARAM, outcome);

		return redirect(`${location.pathname}${location.search}`, {
			status: redirect.Status.SeeOther,
		});
	}),
});
