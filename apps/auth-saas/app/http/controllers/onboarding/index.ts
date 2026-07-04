import action from "~/app/lib/action";
import { base64UrlEncode } from "~/app/lib/crypto-utils";

/** Well-known client ID for the dashboard OAuth client. */
const DASHBOARD_CLIENT_ID = "dashboard";

/**
 * Onboarding entry point - redirects to platform tenant OAuth flow.
 * This dogfoods the authentication by using the platform tenant's OAuth endpoint.
 */
export default action<"GET", "/onboarding">(async ({ request, logger }) => {
	let log = logger.loader("/onboarding");

	// Generate PKCE code verifier and challenge
	let codeVerifier = generateCodeVerifier();
	let codeChallenge = await generateCodeChallenge(codeVerifier);

	// Generate state for CSRF protection
	let state = crypto.randomUUID();

	// Build the OAuth authorization URL
	let url = new URL(request.url);
	let baseUrl = `${url.protocol}//${url.host}`;

	// In dev, we use the same host. In prod, we'd use the platform domain.
	let authorizeUrl = new URL("/authorize", baseUrl);
	authorizeUrl.searchParams.set("response_type", "code");
	authorizeUrl.searchParams.set("client_id", DASHBOARD_CLIENT_ID);
	authorizeUrl.searchParams.set("redirect_uri", `${baseUrl}/onboarding/callback`);
	authorizeUrl.searchParams.set("scope", "openid email profile");
	authorizeUrl.searchParams.set("state", state);
	authorizeUrl.searchParams.set("code_challenge", codeChallenge);
	authorizeUrl.searchParams.set("code_challenge_method", "S256");

	log.info("Redirecting to OAuth authorization", { clientId: DASHBOARD_CLIENT_ID });

	// Store PKCE verifier and state in a short-lived cookie
	let oauthStateCookie = JSON.stringify({ codeVerifier, state });
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
