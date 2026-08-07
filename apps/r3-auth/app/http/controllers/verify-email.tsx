/**
 * `GET /verify-email` — consumes the token a verification message carried and records
 * that the address it was issued for is confirmed.
 *
 * Unauthenticated by design: the link is followed from an inbox, in whatever browser the
 * mail was opened in, and requiring a session here would answer a perfectly good token
 * with a sign-in page. The token is the only thing that authorizes the write, which is why
 * it is single-use, short-lived and bound to both the subject and the address.
 *
 * Every way a token can fail to confirm — expired, already used, malformed, or issued for
 * an address the account no longer holds — is answered with the same page. They are one
 * outcome to the reader, and telling them apart would tell whoever is holding the link
 * something they should not learn from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { VerificationError } from "~/app/services/email-verification";

import { VerifyEmailQuerySchema } from "~/app/http/validators/email-verification";
import { consumeVerificationToken } from "~/app/services/email-verification";
import DocumentLayout from "~/resources/layouts/document";
import VerifyEmailView from "~/resources/views/verify-email";
import routes from "~/routes/web";

/**
 * Renders one outcome of following a link.
 *
 * @param outcome - Which locale subsection the copy is read from.
 * @param status - HTTP status; a refused token is a client error, not a server one, and
 *   an outcome the store could not answer is reported as temporary so a crawler or a
 *   retrying client does not treat it as final.
 */
function outcomePage(
	ctx: RequestContext,
	outcome: "verified" | "invalid" | "unavailable",
	status: number,
): Response | Promise<Response> {
	let action: { label: string; href: string } | null = null;

	if (outcome === "verified") {
		action = {
			label: ctx.i18next.t("verifyEmail.verified.action"),
			href: routes.account.profile.href(),
		};
	}

	if (outcome === "invalid") {
		// To the sign-in page rather than straight to the profile: a reader holding a dead
		// link often has no session either, and the resend control lives behind one.
		action = {
			label: ctx.i18next.t("verifyEmail.invalid.action"),
			href: routes.authorize.index.href(),
		};
	}

	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("verifyEmail.documentTitle")}>
			<VerifyEmailView
				title={ctx.i18next.t(`verifyEmail.${outcome}.title`)}
				description={ctx.i18next.t(`verifyEmail.${outcome}.description`)}
				action={action}
			/>
		</DocumentLayout>,
		{ status },
	);
}

/** The page a failed consumption is answered with, by why it failed. */
function failurePage(ctx: RequestContext, error: VerificationError): Response | Promise<Response> {
	if (error.reason === "unavailable") return outcomePage(ctx, "unavailable", 503);

	return outcomePage(ctx, "invalid", 400);
}

export default createAction(
	routes.verifyEmail,
	inject([Database] as const, async (db) => {
		let ctx = getContext();

		let query = await validate(ctx.url.searchParams, VerifyEmailQuerySchema);
		if (isFailure(query)) {
			// No token id, no digest, nothing derived from the value: a log line naming any of
			// those is a log line somebody could verify an address with.
			ctx.logger.info("email_verification_token_malformed");
			return outcomePage(ctx, "invalid", 400);
		}

		let result = await consumeVerificationToken(db, query.data.token);

		if (isFailure(result)) {
			ctx.logger.info("email_verification_token_refused", { reason: result.error.reason });
			return failurePage(ctx, result.error);
		}

		ctx.logger.info("email_verified", { subjectId: result.data.id });

		return outcomePage(ctx, "verified", 200);
	}),
);
