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

import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
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
 * Headers that end the browser's relationship with this origin. Reserved for the branch
 * that navigates away: clearing site data while the front-channel iframes are still
 * loading would cut them off.
 */
const CLEAR_SITE_DATA: HeadersInit = { "Clear-Site-Data": '"*"' };

/**
 * Renders the interactive sign-out confirmation, the answer to every request that
 * leaves the parameters or the subject undetermined: the person in front of the browser
 * can still answer the question the page asks.
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
 * back so a relying party can correlate the round trip. Falls back to this server's own
 * authorization endpoint, since `target` holds only addresses a client registered.
 */
function postLogoutUrl(ctx: RequestContext, target: string | undefined, state?: string): string {
	let url = new URL(target ?? new URL(routes.authorize.index.href(), ctx.url.origin).toString());
	if (state) url.searchParams.set("state", state);
	return url.toString();
}

export default createController(routes.oidc.logout, {
	actions: {
		/**
		 * GET /oidc/logout — an RP-initiated logout, or the confirmation page when the
		 * request leaves the subject undetermined. Back-channel delivery uses recipient
		 * lists captured before the sessions were deleted; a refused request answers 400.
		 */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let result = await validate(ctx.url.searchParams, LogoutQuerySchema);
			if (isFailure(result)) {
				ctx.log.note("oidc.logout.params_invalid");
				return confirmationPage(ctx);
			}

			let params = result.data;
			let accessToken = getAccessToken();
			let refreshToken = getRefreshToken();
			let sessionSubject = accessToken ? getSubjectFromAccessToken(accessToken) : null;

			if (!params.id_token_hint && !sessionSubject) {
				ctx.log.note("oidc.logout.hint_missing");
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
				if (error instanceof OIDC.InvalidRequestError) {
					ctx.log.set({ oidc: { error: "invalid_request" } });
					ctx.log.note("oidc.logout.refused", { reason: error.message });
					return badRequest({ error: "invalid_request", error_description: error.message });
				}

				throw error;
			}

			await provider.deliverBackchannelLogoutTokens(logout.subjectId, logout.backchannelSessions);

			if (refreshToken) await Session.deleteById(db, refreshToken);

			ctx.log.set({
				subject: { id: logout.subjectId },
				logout: {
					backchannel_count: logout.backchannelSessions.length,
					frontchannel_count: logout.frontchannelUrls.length,
				},
			});
			ctx.log.note("oidc.logout.completed");

			unsetTokens();

			let redirectUri = postLogoutUrl(ctx, logout.redirectUri, params.state);

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
		 * back to the authorization endpoint. Back-channel tokens reach every relying
		 * party, sent while the session rows they are derived from still exist.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let accessToken = getAccessToken();
			let refreshToken = getRefreshToken();

			if (accessToken && refreshToken) {
				let subjectId = getSubjectFromAccessToken(accessToken);

				if (subjectId) {
					await createOidcProvider(db).sendBackchannelLogoutTokens(subjectId);
				}

				await Session.deleteById(db, refreshToken);
				ctx.log.set({ subject: { id: subjectId ?? undefined } });
				ctx.log.note("oidc.logout.completed");
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
