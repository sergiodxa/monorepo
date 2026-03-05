import type { JSONValue } from "@pkg/types";

import { html } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import routes from "~/app/routes";
import Tenant from "~/app/models/tenant";
import action from "~/lib/action";
import { base64UrlDecode } from "~/lib/crypto-utils";
import { createSessionToken } from "~/lib/platform-session";

/** Schema for OAuth callback query parameters. */
let CallbackSchema = s.object({
	code: s.string(),
	state: s.string(),
});

/** Schema for the OAuth state cookie. */
let OAuthStateSchema = s.object({
	codeVerifier: s.string(),
	state: s.string(),
});

/** Schema for the token response. */
let TokenResponseSchema = s.object({
	access_token: s.string(),
	token_type: s.string(),
	expires_in: s.number(),
	id_token: s.optional(s.string()),
	refresh_token: s.optional(s.string()),
});

/** Schema for ID token claims (minimal). */
let IdTokenClaimsSchema = s.object({
	sub: s.string(),
	email: s.optional(s.string()),
	email_verified: s.optional(s.boolean()),
	/** Session ID from the tenant (sid claim) */
	sid: s.optional(s.string()),
});

/** Well-known client ID for the dashboard OAuth client. */
const DASHBOARD_CLIENT_ID = "dashboard";

/**
 * OAuth callback handler for platform authentication.
 * Exchanges the authorization code for tokens and creates a platform session.
 */
export default action<"GET", "/onboarding/callback">(async ({ request, db, logger }) => {
	let log = logger.loader("/onboarding/callback");
	let url = new URL(request.url);

	// Parse callback parameters
	let params = Object.fromEntries(url.searchParams);
	let result = await validate(params, CallbackSchema);
	if (isFailure(result)) {
		log.error("Invalid callback parameters", { issues: result.error.issues });
		return renderError("Invalid callback parameters");
	}

	let { code, state } = result.data;

	// Get and validate OAuth state from cookie
	let cookieHeader = request.headers.get("Cookie") ?? "";
	let stateMatch = cookieHeader.match(/__oauth_state=([^;]+)/);
	if (!stateMatch || !stateMatch[1]) {
		log.error("Missing OAuth state cookie");
		return renderError("Session expired. Please try again.");
	}

	let oauthStateResult = await validate(
		JSON.parse(base64UrlDecode(stateMatch[1])) as JSONValue,
		OAuthStateSchema,
	);
	if (isFailure(oauthStateResult)) {
		log.error("Invalid OAuth state cookie");
		return renderError("Invalid session state. Please try again.");
	}

	let { codeVerifier, state: expectedState } = oauthStateResult.data;

	// Verify state matches (CSRF protection)
	if (state !== expectedState) {
		log.error("State mismatch", { expected: expectedState, received: state });
		return renderError("Security validation failed. Please try again.");
	}

	// Exchange code for tokens
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
		log.error("Token exchange failed", { status: tokenResponse.status, error: errorText });
		return renderError("Authentication failed. Please try again.");
	}

	let tokenData = (await tokenResponse.json()) as JSONValue;
	let tokenResult = await validate(tokenData, TokenResponseSchema);
	if (isFailure(tokenResult)) {
		log.error("Invalid token response", { issues: tokenResult.error.issues });
		return renderError("Authentication failed. Please try again.");
	}

	// Decode the ID token to get user info
	let idToken = tokenResult.data.id_token;
	if (!idToken) {
		log.error("No ID token in response");
		return renderError("Authentication failed. Please try again.");
	}

	let claims = decodeIdToken(idToken) as JSONValue;
	let claimsResult = await validate(claims, IdTokenClaimsSchema);
	if (isFailure(claimsResult)) {
		log.error("Invalid ID token claims", { issues: claimsResult.error.issues });
		return renderError("Authentication failed. Please try again.");
	}

	let { sub: subjectId, email, sid: tenantSessionId } = claimsResult.data;
	if (!email) {
		log.error("No email in ID token");
		return renderError("Email is required for authentication.");
	}

	// Resolve any pending ownership for this email
	let resolvedCount = await Tenant.resolvePendingOwnership(db, email, subjectId);
	if (resolvedCount > 0) {
		log.info("Resolved pending ownership", { email, count: resolvedCount });
	}

	// Create platform session with the tenant session ID from the ID token
	let sessionToken = await createSessionToken(
		subjectId,
		email,
		env.SESSION_SECRET,
		tenantSessionId,
	);

	log.info("Login successful", { subjectId, tenantSessionId });

	// Redirect to dashboard with session cookie
	let headers = new Headers();
	headers.set("Location", routes.dashboard.index.href());
	headers.append(
		"Set-Cookie",
		`__platform_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
	);
	// Clear the OAuth state cookie
	headers.append("Set-Cookie", `__oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

	return new Response(null, { status: 302, headers });
});

/**
 * Decodes an ID token (JWT) without verification.
 * The token was already verified by the OAuth server during token exchange.
 */
function decodeIdToken(idToken: string): unknown {
	let parts = idToken.split(".");
	if (parts.length !== 3) return {};
	let payload = parts[1];
	if (!payload) return {};
	try {
		return JSON.parse(base64UrlDecode(payload));
	} catch {
		return {};
	}
}

/**
 * Renders an error page.
 */
function renderError(message: string) {
	return html(
		`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Authentication Error - Auth SaaS</title>
	<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
	<div class="max-w-md w-full px-4">
		<div class="bg-white rounded-lg border shadow-sm p-6 text-center">
			<h1 class="text-xl font-bold text-red-600 mb-4">Authentication Error</h1>
			<p class="text-gray-600 mb-4">${message}</p>
			<a href="${routes.onboarding.index.href()}" class="text-blue-600 hover:underline">Try again</a>
		</div>
	</div>
</body>
</html>`,
		{ status: 400 },
	);
}
