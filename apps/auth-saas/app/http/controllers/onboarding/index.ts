/**
 * `GET /onboarding` — the onboarding entry point that kicks off the platform's own
 * OAuth 2.0 / PKCE authorization flow. The dashboard dogfoods its own OIDC provider
 * by treating itself as the `dashboard` OAuth client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { base64UrlEncode } from "~/app/lib/crypto-utils";
import routes from "~/routes/web";

const DASHBOARD_CLIENT_ID = "dashboard";

/**
 * Generates a PKCE verifier/challenge and a nonce that the callback checks
 * against the ID token to reject replayed or injected tokens, stashing them
 * in a short-lived `__oauth_state` cookie before redirecting to `/authorize`.
 *
 * @returns A `302` redirect to the authorization URL with the PKCE state cookie set.
 * @example
 * router.map(routes.onboarding.index, onboardingIndex);
 */
export default createAction(routes.onboarding.index, async ({ request, logger }) => {
	let log = logger.loader("/onboarding");

	let codeVerifier = generateCodeVerifier();
	let codeChallenge = await generateCodeChallenge(codeVerifier);

	let state = crypto.randomUUID();

	let nonce = crypto.randomUUID();

	let url = new URL(request.url);
	let baseUrl = `${url.protocol}//${url.host}`;

	let authorizeUrl = new URL("/authorize", baseUrl);
	authorizeUrl.searchParams.set("response_type", "code");
	authorizeUrl.searchParams.set("client_id", DASHBOARD_CLIENT_ID);
	authorizeUrl.searchParams.set("redirect_uri", `${baseUrl}/onboarding/callback`);
	authorizeUrl.searchParams.set("scope", "openid email profile");
	authorizeUrl.searchParams.set("state", state);
	authorizeUrl.searchParams.set("nonce", nonce);
	authorizeUrl.searchParams.set("code_challenge", codeChallenge);
	authorizeUrl.searchParams.set("code_challenge_method", "S256");

	log.info("Redirecting to OAuth authorization", { clientId: DASHBOARD_CLIENT_ID });

	let oauthStateCookie = JSON.stringify({ codeVerifier, state, nonce });
	let cookieValue = base64UrlEncode(oauthStateCookie);

	return new Response(null, {
		status: 302,
		headers: {
			Location: authorizeUrl.toString(),
			"Set-Cookie": `__oauth_state=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
		},
	});
});

/**
 * Generates a cryptographically random code verifier for PKCE.
 * @returns A 43-character base64url-encoded random string.
 */
function generateCodeVerifier(): string {
	let bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

/**
 * Generates the code challenge from a code verifier using S256 method.
 * @param verifier - The code verifier.
 * @returns The base64url-encoded SHA-256 hash of the verifier.
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
	let encoder = new TextEncoder();
	let data = encoder.encode(verifier);
	let hash = await crypto.subtle.digest("SHA-256", data);
	return base64UrlEncode(new Uint8Array(hash));
}
