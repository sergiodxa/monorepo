/**
 * `GET /signup/pending` — the "check your email" state `signup.submit` redirects to,
 * carrying the new subject id and whether its own verification send failed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { PublicDocument } from "~/app/views/landing";
import { SignUpPendingPage } from "~/app/views/signup";
import routes from "~/routes/web";

/**
 * Renders the "check your email" state for the subject its `subject` query
 * parameter names, noting a failed send when one is carried along.
 *
 * @param ctx - The request context (provides `render`).
 * @returns The rendered pending screen.
 * @example
 * router.map(routes.signup.pending, signupPending);
 */
export default createAction(routes.signup.pending, async (ctx) => {
	let subjectId = ctx.url.searchParams.get("subject");
	let sendFailed = ctx.url.searchParams.get("sendFailed") === "1";
	let resendAction = subjectId
		? `${routes.signup.resend.href()}?subject=${subjectId}`
		: routes.signup.resend.href();

	return ctx.render(
		<PublicDocument title="Auth SaaS - Check your email">
			<SignUpPendingPage resendAction={resendAction} resent={false} sendFailed={sendFailed} />
		</PublicDocument>,
	);
});
