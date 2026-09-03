/**
 * The external sign-in callback. Resolves the provider identity to a subject, issues
 * the authorization code for the request parked in the session, and answers the
 * relying party in the response mode it asked for. Anything that goes wrong after the
 * authorization request is known reaches the relying party as an OAuth error at its
 * own redirect URI, keeping the person's browser inside the flow they started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { getClientIP } from "@pkg/get-client-ip";
import { badRequest } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

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
 * Name of the OpenID Connect Session Management browser-state cookie. Frozen: the
 * check-session iframe recomputes the `session_state` a relying party was given from
 * exactly this cookie, so renaming it breaks session monitoring for live clients.
 */
export const OP_BROWSER_STATE_COOKIE = "op_browser_state";

/** Browser-state cookie lifetime in seconds (30 days), matching the session's own. */
const OP_BROWSER_STATE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Serializes the browser-state cookie. `SameSite=None; Secure` is required: relying
 * parties read the cookie from a cross-origin iframe, which receives it only under
 * those attributes.
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

/**
 * GET /auth/:provider/callback — completes an external sign-in and answers the
 * relying party. The parked authorization request is read before the exchange, and
 * cleared once answered unless this server's own client still needs it downstream.
 */
export default createAction(
	routes.auth.providerCallback,
	inject([Database, RateLimiters] as const, async (db, limiters) => {
		let ctx = getContext();
		ctx.logger.info("oauth_callback_received", { provider: ctx.params.provider });

		let limited = await spendRateLimit(limiters.login, getClientIP(ctx.request) ?? "unknown");
		if (limited) return limited;

		if (ctx.params.provider !== "github") {
			ctx.logger.info("oauth_invalid_provider", { provider: ctx.params.provider });
			return badRequest({ message: "Invalid provider" });
		}

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

		let subject = await resolveGitHubSubject(db, ctx.billing, identity.data);
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

		await notifyNewSignIn(ctx, db, subject.data);

		await sendVerificationEmail(ctx, db, subject.data);

		if (authz.clientId !== AUTH_SERVER_CLIENT_ID) unsetAuthz();

		let response = await authorizationResponse(
			ctx,
			result.data.redirectUri,
			result.data.params,
			result.data.responseMode,
		);

		response.headers.append("Set-Cookie", opBrowserStateCookie(opBrowserState));

		return response;
	}),
);
