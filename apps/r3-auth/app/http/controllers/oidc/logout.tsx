/**
 * The end-session endpoint. `GET` answers an OpenID Connect RP-initiated logout: it
 * identifies the subject from an `id_token_hint` or the browser session, notifies every
 * other relying party over the back channel, deletes the subject's sessions, and either
 * renders the front-channel iframe page or sends the browser to the post-logout address.
 * `POST` is the interactive sign-out button on this server's own pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@pkg/http/response";
import { badRequest } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { OIDC } from "~/app/auth/oidc-provider";
import { createOidcProvider } from "~/app/auth/repository";
import Session from "~/app/data/session";
import {
	destroySession,
	getAccessToken,
	getRefreshToken,
	unsetTokens,
} from "~/app/http/middleware/session";
import { LogoutQuerySchema } from "~/app/http/validators/logout";
import { getSubjectFromAccessToken } from "~/app/services/access-token-claims";
import LogoutView from "~/resources/views/logout";
import LogoutFrontchannelView from "~/resources/views/logout-frontchannel";
import routes from "~/routes/web";

/**
 * Headers that end the browser's relationship with this origin: the session cookie is
 * replaced with an empty one, and the browser is asked to drop everything else it kept.
 *
 * Sent only on the branch that navigates away. The front-channel page cannot use them:
 * clearing site data while its iframes are still loading would cut them off.
 */
const CLEAR_SITE_DATA: HeadersInit = { "Clear-Site-Data": '"*"' };

/**
 * Renders the interactive sign-out confirmation.
 *
 * It is what a browser gets whenever the request is not a usable RP-initiated logout —
 * malformed parameters, or no way to tell who is signing out — because the person in
 * front of it can still answer the question the page asks.
 */
function confirmationPage(ctx: RequestContext): Response | Promise<Response> {
	return ctx.render(
		<LogoutView
			documentTitle={ctx.i18next.t("logout.documentTitle")}
			title={ctx.i18next.t("logout.title")}
			cta={ctx.i18next.t("logout.cta")}
		/>,
	);
}

/**
 * The address the browser continues to once logout has happened, with `state` echoed
 * back when the relying party sent one so it can correlate the round trip.
 *
 * Falls back to this server's own authorization endpoint: `target` is only ever set to
 * an address a registered client nominated, so an absent one means the browser has
 * nowhere verified to go and is kept here — which is also what an address that could
 * not be verified lands on, since the sign-out itself still went through.
 */
function postLogoutUrl(ctx: RequestContext, target: string | undefined, state?: string): string {
	let url = new URL(target ?? new URL(routes.authorize.index.href(), ctx.url.origin).toString());
	if (state) url.searchParams.set("state", state);
	return url.toString();
}

export default createController(routes.oidc.logout, {
	actions: {
		/**
		 * GET /oidc/logout — performs an RP-initiated logout, or asks the person to
		 * confirm one when the request does not carry enough to perform it.
		 */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let result = await validate(ctx.url.searchParams, LogoutQuerySchema);
			if (isFailure(result)) {
				ctx.logger.info("logout_invalid_params");
				return confirmationPage(ctx);
			}

			let params = result.data;
			let accessToken = getAccessToken();
			let refreshToken = getRefreshToken();
			let sessionSubject = accessToken ? getSubjectFromAccessToken(accessToken) : null;

			// Without either, there is nobody to log out: an anonymous browser asking for
			// somebody's session to end is not a request this server can answer.
			if (!params.id_token_hint && !sessionSubject) {
				ctx.logger.info("logout_missing_id_token_hint");
				return confirmationPage(ctx);
			}

			let logout: Awaited<ReturnType<OIDC["logout"]>>;
			let provider = createOidcProvider(db);

			try {
				logout = await provider.logout({
					idTokenHint: params.id_token_hint,
					postLogoutRedirectUri: params.post_logout_redirect_uri,
					sessionSubject: sessionSubject ?? undefined,
					clientId: params.client_id,
					state: params.state,
				});
			} catch (error) {
				// A refused logout request is the client's mistake — a hint this server did
				// not sign, a client_id contradicting one it did — and it is answered as one
				// rather than as a page that pretends the sign-out happened. An address the
				// server cannot verify is not among these: that logout goes ahead and simply
				// ends up back here.
				if (error instanceof OIDC.InvalidRequestError) {
					ctx.logger.info("logout_rejected", { reason: error.message });
					return badRequest({ error: "invalid_request", error_description: error.message });
				}

				throw error;
			}

			// The recipient lists were read before the sessions were deleted; delivering
			// them now is the last thing that needs those rows to have existed.
			await provider.deliverBackchannelLogoutTokens(logout.subjectId, logout.backchannelSessions);

			// The subject's sessions are already gone, but this browser's row is deleted by
			// its refresh token too: a logout driven by an `id_token_hint` may name a
			// different subject than the one holding this cookie.
			if (refreshToken) await Session.deleteById(db, refreshToken);

			ctx.logger.info("logout_success", {
				subjectId: logout.subjectId,
				backchannelCount: logout.backchannelSessions.length,
				frontchannelCount: logout.frontchannelUrls.length,
			});

			unsetTokens();

			let redirectUri = postLogoutUrl(ctx, logout.redirectUri, params.state);

			// The iframes have to run somewhere, and a redirect would never give them the
			// chance, so the page itself becomes the delay before the browser moves on.
			if (logout.frontchannelUrls.length > 0) {
				return ctx.render(
					<LogoutFrontchannelView
						documentTitle={ctx.i18next.t("logout.documentTitle")}
						title={ctx.i18next.t("logout.title")}
						signingOut={ctx.i18next.t("logout.signing_out")}
						redirecting={ctx.i18next.t("logout.redirecting")}
						continueLabel={ctx.i18next.t("logout.continue")}
						urls={logout.frontchannelUrls}
						redirectUri={redirectUri}
					/>,
				);
			}

			destroySession();

			return redirect(redirectUri, {
				status: redirect.Status.SeeOther,
				headers: CLEAR_SITE_DATA,
			});
		}),

		/**
		 * POST /oidc/logout — signs the person out of this server itself and sends them
		 * back to the authorization endpoint.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let accessToken = getAccessToken();
			let refreshToken = getRefreshToken();

			if (accessToken && refreshToken) {
				let subjectId = getSubjectFromAccessToken(accessToken);

				if (subjectId) {
					// Sent while the session rows still exist, since the recipient list is
					// derived from them. No client is excluded: this logout was started here,
					// so every relying party is hearing about it for the first time.
					await createOidcProvider(db).sendBackchannelLogoutTokens(subjectId);
				}

				await Session.deleteById(db, refreshToken);
				ctx.logger.info("logout_success", { subjectId });
				unsetTokens();
			}

			destroySession();

			return redirect(routes.authorize.index.href(), {
				status: redirect.Status.SeeOther,
				headers: CLEAR_SITE_DATA,
			});
		}),
	},
});
