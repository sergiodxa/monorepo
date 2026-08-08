/**
 * `/password/reset` — the page a recovery link opens, and the submission that spends the
 * link and writes a new password. `GET` only checks that the token is still live, so an
 * expired or already-used link becomes a page that says so; `POST` consumes it, replaces
 * the hash, and ends every session on the account.
 *
 * Ending the sessions is the security point of the endpoint rather than a courtesy: a
 * session row's id *is* the refresh token, so a session left behind after a reset is a live
 * credential in whoever's hands prompted the reset. The new password is derived with the
 * same PBKDF2 policy registration uses; nothing here invents a hash.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/fetch-router";

import { password } from "@pkg/crypto";
import { getClientIP } from "@pkg/get-client-ip";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database as DatabaseKey } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { createOidcProvider } from "~/app/auth/repository";
import Credential from "~/app/data/credential";
import Session from "~/app/data/session";
import Subject from "~/app/data/subject";
import { DEFAULT_EMAIL_LOCALE } from "~/app/emails/locale";
import { PasswordChangedEmail } from "~/app/emails/password-changed";
import { unsetTokens } from "~/app/http/middleware/session";
import { ResetPasswordSchema, ResetTokenQuerySchema } from "~/app/http/validators/password";
import { consumePasswordResetToken, peekPasswordResetToken } from "~/app/services/password-reset";
import { spendRateLimit } from "~/app/services/rate-limit";
import RateLimiters from "~/app/services/rate-limiters";
import DocumentLayout from "~/resources/layouts/document";
import PasswordNoticeView from "~/resources/views/password/notice";
import ResetPasswordView from "~/resources/views/password/reset";
import routes from "~/routes/web";

/**
 * Headers every page carrying a token in its URL is served with.
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
 * Renders the new-password form for a token that was live a moment ago.
 *
 * @param token - The token the form will spend, carried as a hidden field.
 * @param error - Why the previous submission was refused, already translated.
 */
function resetPage(
	ctx: RequestContext,
	token: string,
	error: string | null,
): Response | Promise<Response> {
	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("password.reset.documentTitle")} clientRuntime={false}>
			<ResetPasswordView
				title={ctx.i18next.t("password.reset.title")}
				description={ctx.i18next.t("password.reset.description")}
				token={token}
				password={{
					label: ctx.i18next.t("password.reset.password.label"),
					placeholder: ctx.i18next.t("password.reset.password.placeholder"),
				}}
				confirmation={{
					label: ctx.i18next.t("password.reset.confirmation.label"),
					placeholder: ctx.i18next.t("password.reset.confirmation.placeholder"),
				}}
				submit={ctx.i18next.t("password.reset.submit")}
				error={error}
			/>
		</DocumentLayout>,
		{ status: error ? 400 : 200, headers: TOKEN_PAGE_HEADERS },
	);
}

/**
 * The page for a link that cannot be used: expired, already spent, malformed, or issued for
 * a subject that no longer exists.
 *
 * One page for all four, deliberately. Distinguishing them would tell somebody holding a
 * token they did not receive which of those it is, and the reader's next step — ask for a
 * new link — is the same in every case. It is a `400`, not a `500`: nothing went wrong on
 * this server.
 */
function invalidPage(ctx: RequestContext): Response | Promise<Response> {
	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("password.invalid.documentTitle")} clientRuntime={false}>
			<PasswordNoticeView
				title={ctx.i18next.t("password.invalid.title")}
				description={ctx.i18next.t("password.invalid.description")}
				action={{
					label: ctx.i18next.t("password.invalid.action"),
					href: routes.password.forgot.index.href(),
				}}
			/>
		</DocumentLayout>,
		{ status: 400, headers: TOKEN_PAGE_HEADERS },
	);
}

/** The page a completed reset ends on, offering the way back to signing in. */
function donePage(ctx: RequestContext): Response | Promise<Response> {
	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("password.done.documentTitle")} clientRuntime={false}>
			<PasswordNoticeView
				title={ctx.i18next.t("password.done.title")}
				description={ctx.i18next.t("password.done.description")}
				action={{
					label: ctx.i18next.t("password.done.action"),
					href: routes.authorize.index.href(),
				}}
			/>
		</DocumentLayout>,
		{ headers: TOKEN_PAGE_HEADERS },
	);
}

/**
 * Ends every session the subject has, and tells the relying parties that hold one.
 *
 * The notification runs first because it is derived from the session rows: once they are
 * deleted there is nothing left to work out who to notify from. It is best effort and its
 * failure is logged rather than raised — an unreachable relying party must not stop the
 * account's own refresh tokens from being destroyed, which is the part that actually
 * revokes access.
 *
 * @returns How many sessions were revoked, for the log line.
 */
async function revokeSessions(ctx: RequestContext, db: Database, subjectId: string) {
	try {
		await createOidcProvider(db).sendBackchannelLogoutTokens(subjectId);
	} catch (error) {
		ctx.logger.error("password_reset_backchannel_failed", {
			subjectId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}

	return await Session.deleteBySubjectId(db, subjectId);
}

/** The token a refused submission should be re-offered with, or `null` when it sent none. */
function submittedToken(formData: FormData): string | null {
	let value = formData.get("token");
	return typeof value === "string" && value.length > 0 ? value : null;
}

export default createController(routes.password.reset, {
	actions: {
		/**
		 * GET /password/reset — renders the form when the link is still live, and the
		 * "unusable link" page otherwise. Reading a token never spends it, so reloading this
		 * page is safe.
		 */
		index: inject([RateLimiters] as const, async (limiters) => {
			let ctx = getContext();

			let query = await validate(ctx.url.searchParams, ResetTokenQuerySchema);
			if (isFailure(query)) {
				ctx.logger.info("password_reset_link_malformed");
				return invalidPage(ctx);
			}

			// Spent only once the request presents something that could be a token, and so
			// only by a request that is about to cost a store read. A page fetched with no
			// token — a crawler, a monitor, a bodyless probe on the bare path — is answered
			// out of the shape check above and takes nothing from the budget, which matters
			// because this is the same budget a person's sign-in attempts come out of and it
			// is keyed by IP: whoever shares an egress with a prober must not be locked out
			// of signing in by it. Somebody walking the token space still presents a
			// well-formed token every time and is still stopped at ten a minute.
			let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
			if (limited) return limited;

			let subjectId = await peekPasswordResetToken(query.data.token);
			if (!subjectId) {
				ctx.logger.info("password_reset_link_unusable");
				return invalidPage(ctx);
			}

			return resetPage(ctx, query.data.token, null);
		}),

		/**
		 * POST /password/reset — spends the link, writes the new password hash, revokes every
		 * session, and notifies the subject.
		 *
		 * The token is consumed before the password is derived, so the expensive derivation
		 * only ever runs for a caller who actually held a live link.
		 */
		action: inject([DatabaseKey, RateLimiters] as const, async (db, limiters) => {
			let ctx = getContext();

			let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
			if (limited) return limited;

			let result = await validate(ctx.formData, ResetPasswordSchema);
			if (isFailure(result)) {
				let token = submittedToken(ctx.formData);
				if (!token) {
					ctx.logger.info("password_reset_submission_malformed");
					return invalidPage(ctx);
				}

				ctx.logger.info("password_reset_submission_invalid");
				return resetPage(ctx, token, ctx.i18next.t("password.reset.errors.invalid"));
			}

			// Compared here rather than in the schema so the mismatch has a message of its own:
			// "these do not match" is a different instruction from "this is too short".
			if (result.data.password !== result.data.passwordConfirmation) {
				ctx.logger.info("password_reset_confirmation_mismatch");
				return resetPage(ctx, result.data.token, ctx.i18next.t("password.reset.errors.mismatch"));
			}

			let subjectId = await consumePasswordResetToken(result.data.token);
			if (!subjectId) {
				ctx.logger.info("password_reset_token_unusable");
				return invalidPage(ctx);
			}

			let subject = await Subject.findById(db, subjectId);
			if (!subject) {
				// Issued for an account that has since been deleted. The token is already spent.
				ctx.logger.info("password_reset_subject_missing", { subjectId });
				return invalidPage(ctx);
			}

			let hash = await password.hash(result.data.password);
			if (isFailure(hash)) {
				ctx.logger.error("password_reset_hash_failed", { subjectId });
				return ctx.render(
					<DocumentLayout
						title={ctx.i18next.t("password.invalid.documentTitle")}
						clientRuntime={false}
					>
						<PasswordNoticeView
							title={ctx.i18next.t("password.reset.errors.failedTitle")}
							description={ctx.i18next.t("password.reset.errors.failed")}
							action={{
								label: ctx.i18next.t("password.invalid.action"),
								href: routes.password.forgot.index.href(),
							}}
						/>
					</DocumentLayout>,
					{ status: 500, headers: TOKEN_PAGE_HEADERS },
				);
			}

			await Credential.setVerifiedPassword(db, subjectId, hash.data, Date.now());

			let revoked = await revokeSessions(ctx, db, subjectId);

			// The browser that performed the reset may itself have been holding a session this
			// server issued; those tokens are dead now, so the cookie stops claiming otherwise.
			unsetTokens();

			ctx.email.later(
				new PasswordChangedEmail({
					email: subject.email_address,
					locale: DEFAULT_EMAIL_LOCALE,
					t: ctx.i18next.getFixedT(DEFAULT_EMAIL_LOCALE),
				}),
			);

			ctx.logger.info("password_reset_completed", { subjectId, revoked });

			return donePage(ctx);
		}),
	},
});
