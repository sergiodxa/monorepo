/**
 * `GET /onboarding/callback` — the platform OAuth callback. Exchanges the
 * authorization code for tokens, verifies the ID token, resolves pending
 * tenant ownership, and establishes the platform session before redirecting
 * to the dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { isFailure, wrap } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { base64UrlDecode } from "~/app/lib/crypto-utils";
import { verifyIdToken } from "~/app/lib/id-token-verify";
import { createSessionCookie, createSessionToken } from "~/app/lib/platform-session";
import Tenant from "~/app/models/tenant";
import { AuthErrorPage, PublicDocument } from "~/app/views/landing";
import routes from "~/routes/web";

let CallbackSchema = s.object({
	code: s.string(),
	state: s.string(),
});

let OAuthStateSchema = s.object({
	codeVerifier: s.string(),
	state: s.string(),
	nonce: s.string(),
});

let TokenResponseSchema = s.object({
	access_token: s.string(),
	token_type: s.string(),
	expires_in: s.number(),
	id_token: s.optional(s.string()),
	refresh_token: s.optional(s.string()),
});

const DASHBOARD_CLIENT_ID = "dashboard";

/**
 * Exchanges the authorization code for tokens, then verifies the ID token's
 * signature, issuer, audience, and nonce against the keys the platform provider
 * publishes, so only a valid, unreplayed token can establish a platform session.
 */
export default createAction(
	routes.onboarding.callback,
	inject([Database] as const, async (db) => {
		let { request, log } = getContext();
		let url = new URL(request.url);

		let params = Object.fromEntries(url.searchParams);
		let result = await validate(params, CallbackSchema);
		if (isFailure(result)) {
			log.warn("onboarding.invalid_params", { issues: result.error.issues.length });
			return renderError("Invalid callback parameters");
		}

		let { code, state } = result.data;

		let cookieHeader = request.headers.get("Cookie") ?? "";
		let stateMatch = cookieHeader.match(/__oauth_state=([^;]+)/);
		if (!stateMatch || !stateMatch[1]) {
			log.warn("onboarding.state_cookie_missing");
			return renderError("Session expired. Please try again.");
		}

		let oauthStateResult = await validate(
			JSON.parse(base64UrlDecode(stateMatch[1])) as JSONValue,
			OAuthStateSchema,
		);
		if (isFailure(oauthStateResult)) {
			log.warn("onboarding.state_cookie_invalid");
			return renderError("Invalid session state. Please try again.");
		}

		let { codeVerifier, state: expectedState, nonce: expectedNonce } = oauthStateResult.data;

		if (state !== expectedState) {
			log.warn("onboarding.state_mismatch");
			return renderError("Security validation failed. Please try again.");
		}

		let baseUrl = `${url.protocol}//${url.host}`;
		let tokenUrl = new URL("/oauth/token", baseUrl);

		let tokenResponse = await fetch(tokenUrl.toString(), {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: `${baseUrl}/onboarding/callback`,
				client_id: DASHBOARD_CLIENT_ID,
				code_verifier: codeVerifier,
			}),
		});

		if (!tokenResponse.ok) {
			let errorText = await tokenResponse.text();
			log.warn("onboarding.token_exchange_failed", {
				status: tokenResponse.status,
				reason: errorText,
			});
			return renderError("Authentication failed. Please try again.");
		}

		let tokenData = (await tokenResponse.json()) as JSONValue;
		let tokenResult = await validate(tokenData, TokenResponseSchema);
		if (isFailure(tokenResult)) {
			log.warn("onboarding.token_response_invalid", { issues: tokenResult.error.issues.length });
			return renderError("Authentication failed. Please try again.");
		}

		let idToken = tokenResult.data.id_token;
		if (!idToken) {
			log.warn("onboarding.id_token_missing");
			return renderError("Authentication failed. Please try again.");
		}

		let verifiedIdToken = await verifyIdToken(idToken, {
			origin: baseUrl,
			audience: DASHBOARD_CLIENT_ID,
		});
		if (!verifiedIdToken) {
			log.warn("onboarding.id_token_invalid");
			return renderError("Authentication failed. Please try again.");
		}

		if (verifiedIdToken.nonce !== expectedNonce) {
			log.warn("onboarding.nonce_mismatch");
			return renderError("Security validation failed. Please try again.");
		}

		let identity = wrap(() => ({
			subjectId: verifiedIdToken.subject,
			email: verifiedIdToken.email,
			tenantSessionId: verifiedIdToken.sessionId ?? undefined,
		}));
		if (isFailure(identity)) {
			log.warn("onboarding.claims_invalid", { reason: identity.error.message });
			return renderError("Authentication failed. Please try again.");
		}

		let { subjectId, email, tenantSessionId } = identity.data;
		if (!email) {
			log.warn("onboarding.email_missing");
			return renderError("Email is required for authentication.");
		}

		log.set({ user: { id: subjectId } });

		let resolvedCount = await Tenant.resolvePendingOwnership(db, email, subjectId);
		if (resolvedCount > 0) log.note("tenant.ownership_resolved", { count: resolvedCount });

		let sessionToken = await createSessionToken(
			subjectId,
			email,
			env.SESSION_SECRET,
			tenantSessionId,
		);

		log.note("onboarding.login_completed");

		let headers = new Headers();
		headers.set("Location", routes.dashboard.index.href());
		headers.append("Set-Cookie", createSessionCookie(sessionToken, !import.meta.env.DEV));
		headers.append("Set-Cookie", `__oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

		return new Response(null, { status: 302, headers });
	}),
);

/**
 * Renders the onboarding authentication-error page as a `remix/ui` document with a
 * `400 Bad Request` status, using the request-scoped `ctx.render` helper.
 *
 * @param message - The error message shown to the visitor.
 * @returns A `Response` containing the rendered error document.
 * @example
 * return renderError("Authentication failed. Please try again.");
 */
function renderError(message: string) {
	return getContext().render(
		<PublicDocument title="Authentication Error - Auth SaaS" variant="error">
			<AuthErrorPage message={message} />
		</PublicDocument>,
		{ status: 400 },
	);
}
