/**
 * `/password/reset` — the page a recovery link opens and the submission that spends it. `GET`
 * checks the token is still live; `POST` consumes it, replaces the hash, and ends every
 * session on the account, the resetting browser's own cookie included.
 *
 * Ending the sessions is the security point: a session row's id *is* the refresh token, so one
 * left behind after a reset stays a live credential in whoever's hands prompted the reset. The
 * new hash comes from the same scrypt policy registration uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { password } from "@sdxc/crypto";
import { getClientIP } from "@sdxc/get-client-ip";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database as DatabaseKey } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

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
 * Headers every page carrying a token in its URL is served with: `no-referrer` keeps the token
 * out of the `Referer` of anything the page loads or links to, and `no-store` keeps the page
 * out of shared caches and out of a back-button re-render once the token has been spent.
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
 * The page for a link that cannot be used: expired, already spent, malformed, or issued for a
 * subject that no longer exists. One page and one `400` for all four, so a token's holder
 * learns only that it is unusable; the next step, asking for a new link, is the same anyway.
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
 * Ends every session the subject has, and tells the relying parties that hold one. The
 * notification runs first because it is derived from the session rows; its failure is only
 * logged, so the refresh tokens are destroyed even when a relying party is unreachable.
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
		 * GET /password/reset — the form when the link is still live, the "unusable link" page
		 * otherwise; the token survives a read, so reloading is safe. The shape check runs first, so
		 * only a plausible token spends from the IP budget sign-in shares.
		 */
		index: inject([RateLimiters] as const, async (limiters) => {
			let ctx = getContext();

			let query = await validate(ctx.url.searchParams, ResetTokenQuerySchema);
			if (isFailure(query)) {
				ctx.logger.info("password_reset_link_malformed");
				return invalidPage(ctx);
			}

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
		 * POST /password/reset — spends the link, writes the new hash, revokes every session, and
		 * notifies the subject. Consuming the token before deriving the hash keeps that cost for
		 * callers who held a live link; a confirmation mismatch gets its own message.
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
