/**
 * The external sign-in callback. Resolves the provider identity to one of this
 * server's subjects, issues the authorization code for the request parked in the
 * session, sets the browser-state cookie session management depends on, and answers
 * the relying party in the response mode it asked for.
 *
 * Everything that can go wrong after the authorization request is known is reported to
 * the relying party as an OAuth error at its own redirect URI, never as a page here:
 * the person's browser belongs to the flow they started, not to this endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { getClientIP } from "@pkg/get-client-ip";
import { badRequest } from "@pkg/http/response/json";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { AuthzState } from "~/app/http/middleware/session";

import { createOidcProvider } from "~/app/auth/repository";
import { AUTH_SERVER_CLIENT_ID, ISSUER } from "~/app/config";
import { getAuthz, unsetAuthz } from "~/app/http/middleware/session";
import { authorizationResponse } from "~/app/http/responses/authorization-response";
import { sendVerificationEmail } from "~/app/services/email-verification";
import { finishGitHubLogin, resolveGitHubSubject } from "~/app/services/github-login";
import { spendRateLimit } from "~/app/services/rate-limit";
import RateLimiters from "~/app/services/rate-limiters";
import { notifyNewSignIn } from "~/app/services/sign-in-alert";
import routes from "~/routes/web";

/**
 * Name of the OpenID Connect Session Management browser-state cookie.
 *
 * Frozen: the check-session iframe recomputes the `session_state` a relying party was
 * given from exactly this cookie, so renaming it silently breaks session monitoring
 * for every client already running.
 */
export const OP_BROWSER_STATE_COOKIE = "op_browser_state";

/** Browser-state cookie lifetime in seconds (30 days), matching the session's own. */
const OP_BROWSER_STATE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Serializes the browser-state cookie.
 *
 * `SameSite=None; Secure` is required rather than incidental: the cookie is read from
 * a cross-origin iframe embedded by relying parties, and a `Lax` cookie is not sent
 * there at all.
 */
function opBrowserStateCookie(value: string): string {
	return `${OP_BROWSER_STATE_COOKIE}=${value}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${OP_BROWSER_STATE_MAX_AGE}`;
}

/**
 * Sends a failed provider sign-in back to the relying party as an OAuth error, in the
 * response mode its authorization request asked for.
 *
 * @param error - The OAuth error code and the description shown to the person.
 */
async function errorResponse(
	ctx: RequestContext,
	authz: AuthzState,
	error: { code: string; description: string },
): Promise<Response> {
	return await authorizationResponse(
		ctx,
		authz.redirectUri,
		{
			state: authz.state,
			iss: ISSUER,
			error: error.code,
			error_description: error.description,
		},
		authz.responseMode,
	);
}

/** GET /auth/:provider/callback — completes an external sign-in and answers the relying party. */
export default createAction(
	routes.auth.providerCallback,
	inject([Database, PolarClient, RateLimiters] as const, async (db, polar, limiters) => {
		let ctx = getContext();
		ctx.logger.info("oauth_callback_received", { provider: ctx.params.provider });

		let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
		if (limited) return limited;

		if (ctx.params.provider !== "github") {
			ctx.logger.info("oauth_invalid_provider", { provider: ctx.params.provider });
			return badRequest({ message: "Invalid provider" });
		}

		// Read before the exchange: without a parked request there is nowhere to send
		// either an answer or an error, and the only honest response is a refusal here.
		let authz = getAuthz();
		if (!authz) {
			ctx.logger.info("oauth_missing_authz_session");
			return badRequest({ message: "Invalid request" });
		}

		let identity = await finishGitHubLogin(ctx);
		if (isFailure(identity)) {
			ctx.logger.info("oauth_provider_callback_failed", { error: identity.error.code });
			return await errorResponse(ctx, authz, identity.error);
		}

		let subject = await resolveGitHubSubject(db, polar, identity.data);
		if (isFailure(subject)) {
			ctx.logger.info("oauth_subject_resolution_failed", { error: subject.error.code });
			return await errorResponse(ctx, authz, subject.error);
		}

		let oidc = createOidcProvider(db);
		let opBrowserState = oidc.generateOpBrowserState();

		let result = await oidc.loginWithProvider({
			subjectId: subject.data,
			clientId: authz.clientId,
			ip: getClientIP(ctx.request),
			ua: ctx.request.headers.get("user-agent"),
			redirectUri: authz.redirectUri,
			state: authz.state,
			nonce: authz.nonce,
			scope: authz.scope,
			opBrowserState,
			responseMode: authz.responseMode,
			// The challenge the relying party committed to on the authorization request,
			// carried through the session so a provider sign-in enforces PKCE exactly as a
			// password sign-in does.
			pkce: authz.codeChallenge
				? { challenge: authz.codeChallenge, method: authz.codeChallengeMethod ?? "S256" }
				: null,
		});

		if (isFailure(result)) {
			ctx.logger.error("oauth_login_failed", { provider: "github", error: result.error.code });
			return await errorResponse(ctx, authz, {
				code: result.error.code,
				description: result.error.description,
			});
		}

		ctx.logger.info("oauth_login_success", { provider: "github", subjectId: subject.data });

		// Queued, never awaited: the notice is flushed after the response, so a refused
		// delivery cannot turn a completed sign-in into an error the person sees.
		await notifyNewSignIn(ctx, db, subject.data);

		// The same single condition the credential path applies, on the same successful-only
		// branch: null `email_verified_at` means nothing has proven this address, which for a
		// provider sign-in means the provider did not report it verified. A provider that did
		// leaves the column set, so this sends nothing and no method check is needed here.
		await sendVerificationEmail(ctx, db, subject.data);

		// Cleared once answered, except for this server's own client: its callback is the
		// next request in the same flow and still has to check the `state` and the redirect
		// URI this request parked.
		if (authz.clientId !== AUTH_SERVER_CLIENT_ID) unsetAuthz();

		let response = await authorizationResponse(
			ctx,
			result.data.redirectUri,
			result.data.params,
			result.data.responseMode,
		);

		// Only on success: the cookie names a browser this server has an active session
		// for, and there is no session to monitor behind an error.
		response.headers.append("Set-Cookie", opBrowserStateCookie(opBrowserState));

		return response;
	}),
);
