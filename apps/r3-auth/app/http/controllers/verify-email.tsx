/**
 * `/verify-email` — the page a verification message's link opens, and the submission that
 * spends the token and records that the address it was issued for is confirmed.
 *
 * `GET` writes nothing. Following a link is not a decision anybody made: a mailbox is read
 * by scanners, link checkers and previewers, and every one of them fetches the URL — some
 * with a bodyless probe — so a `GET` that consumed the token would confirm the address
 * without the person ever clicking and leave their real click landing on "this link no
 * longer works". So the link only reads the token, and the button on the page is what
 * spends it.
 *
 * Unauthenticated by design: the link is followed from an inbox, in whatever browser the
 * mail was opened in, and requiring a session here would answer a perfectly good token
 * with a sign-in page. The token is the only thing that authorizes the write, which is why
 * it is single-use, short-lived and bound to both the subject and the address.
 *
 * Every way a token can fail to confirm — expired, already used, malformed, or issued for
 * an address the account no longer holds — is answered with the same page, on either
 * method. They are one outcome to the reader, and telling them apart would tell whoever is
 * holding the link something they should not learn from it.
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
import { createController } from "remix/fetch-router";

import type { VerificationError } from "~/app/services/email-verification";

import {
	VerifyEmailFormSchema,
	VerifyEmailQuerySchema,
} from "~/app/http/validators/email-verification";
import { consumeVerificationToken, peekVerificationToken } from "~/app/services/email-verification";
import DocumentLayout from "~/resources/layouts/document";
import VerifyEmailView from "~/resources/views/verify-email";
import VerifyEmailConfirmView from "~/resources/views/verify-email-confirm";
import routes from "~/routes/web";

/**
 * Headers every response here is served with, because the link carries a token in its URL.
 *
 * `no-referrer` keeps the token out of the `Referer` of anything the page loads or links
 * to, and `no-store` keeps the page itself out of shared caches and out of a back-button
 * re-render once the token has been spent.
 */
const TOKEN_PAGE_HEADERS: HeadersInit = {
	"Referrer-Policy": "no-referrer",
	"Cache-Control": "no-store",
	Pragma: "no-cache",
};

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
		{ status, headers: TOKEN_PAGE_HEADERS },
	);
}

/** The page a token that is still unspent is answered with, offering the one button. */
function confirmPage(ctx: RequestContext, token: string): Response | Promise<Response> {
	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("verifyEmail.documentTitle")} clientRuntime={false}>
			<VerifyEmailConfirmView
				title={ctx.i18next.t("verifyEmail.confirm.title")}
				description={ctx.i18next.t("verifyEmail.confirm.description")}
				token={token}
				submit={ctx.i18next.t("verifyEmail.confirm.submit")}
			/>
		</DocumentLayout>,
		{ headers: TOKEN_PAGE_HEADERS },
	);
}

/** The page a failed consumption is answered with, by why it failed. */
function failurePage(ctx: RequestContext, error: VerificationError): Response | Promise<Response> {
	if (error.reason === "unavailable") return outcomePage(ctx, "unavailable", 503);

	return outcomePage(ctx, "invalid", 400);
}

export default createController(routes.verifyEmail, {
	actions: {
		/**
		 * GET /verify-email — reads the token the link carried and offers the button that
		 * spends it. Nothing is consumed and nothing is written, so the URL may be fetched
		 * any number of times by anybody and the person's own click still works.
		 */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let query = await validate(ctx.url.searchParams, VerifyEmailQuerySchema);
			if (isFailure(query)) {
				// No token id, no digest, nothing derived from the value: a log line naming any of
				// those is a log line somebody could verify an address with.
				ctx.logger.info("email_verification_token_malformed");
				return outcomePage(ctx, "invalid", 400);
			}

			let result = await peekVerificationToken(db, query.data.token);

			if (isFailure(result)) {
				ctx.logger.info("email_verification_token_refused", { reason: result.error.reason });
				return failurePage(ctx, result.error);
			}

			return confirmPage(ctx, query.data.token);
		}),

		/**
		 * POST /verify-email — spends the token and stamps the column. This is the only
		 * request that writes anything, and a form is the only thing that issues it.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let form = await validate(ctx.formData, VerifyEmailFormSchema);
			if (isFailure(form)) {
				ctx.logger.info("email_verification_token_malformed");
				return outcomePage(ctx, "invalid", 400);
			}

			let result = await consumeVerificationToken(db, form.data.token);

			if (isFailure(result)) {
				ctx.logger.info("email_verification_token_refused", { reason: result.error.reason });
				return failurePage(ctx, result.error);
			}

			ctx.logger.info("email_verified", { subjectId: result.data.id });

			return outcomePage(ctx, "verified", 200);
		}),
	},
});
