/**
 * `/verify-email` — the page a verification link opens, and the submission that spends
 * the token and confirms the address it names. Scanners and previewers fetch links
 * automatically, so spending the token waits for the person's own click. Every failure
 * — expired, used, malformed, or reissued — renders the same outcome, so a held link
 * reveals nothing about which case applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

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
 * Headers every response here is served with, since the link carries a token in its URL:
 * `no-referrer` scrubs it from any `Referer` header, and `no-store` keeps the page out of
 * shared caches and a back-button re-render once the token is spent.
 */
const TOKEN_PAGE_HEADERS: HeadersInit = {
	"Referrer-Policy": "no-referrer",
	"Cache-Control": "no-store",
	Pragma: "no-cache",
};

/**
 * Renders one outcome of following a link. An invalid outcome's action leads to
 * sign-in, since a reader holding a dead link is typically signed out, and the
 * resend control lives behind a session.
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
		 * GET /verify-email reads the token and offers the button that spends it. The
		 * malformed-token log keeps the token out, since any part of it there could let
		 * someone verify an address.
		 */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let query = await validate(ctx.url.searchParams, VerifyEmailQuerySchema);
			if (isFailure(query)) {
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
