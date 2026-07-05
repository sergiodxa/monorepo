/**
 * Minimal OIDC relying-party helpers for the dashboard's login against the
 * `sso.blog.sergiodxa.com` auth-saas tenant. The ID token is received directly
 * from the token endpoint over TLS with client authentication, so per OIDC
 * §3.1.3.7 the `iss`/`aud`/`exp` claims are validated in place of a signature
 * check for this confidential-client authorization-code flow.
 */

/** Provider metadata subset the dashboard needs. */
export interface OidcMetadata {
	authorization_endpoint: string;
	token_endpoint: string;
	end_session_endpoint?: string;
}

const DEFAULT_SCOPES = ["openid", "profile", "email"];
const metadataCache = new Map<string, OidcMetadata>();

/** Discovers provider metadata (`${issuer}/.well-known/openid-configuration`). */
export async function discover(issuer: string): Promise<OidcMetadata> {
	let cached = metadataCache.get(issuer);
	if (cached) return cached;
	let base = issuer.endsWith("/") ? issuer : `${issuer}/`;
	let response = await fetch(new URL(".well-known/openid-configuration", base), {
		headers: { accept: "application/json" },
	});
	if (!response.ok) throw new Error(`OIDC discovery failed: ${response.status}`);
	let metadata = (await response.json()) as OidcMetadata;
	metadataCache.set(issuer, metadata);
	return metadata;
}

/** A PKCE verifier/challenge pair. */
export interface Pkce {
	verifier: string;
	challenge: string;
}

/** Generates a PKCE verifier and S256 challenge. */
export async function createPkce(): Promise<Pkce> {
	let bytes = crypto.getRandomValues(new Uint8Array(32));
	let verifier = base64url(bytes);
	let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/** Builds the authorization redirect URL. */
export function buildAuthorizationUrl(
	metadata: OidcMetadata,
	input: {
		clientId: string;
		redirectUri: string;
		state: string;
		challenge: string;
		scopes?: string[];
	},
): string {
	let url = new URL(metadata.authorization_endpoint);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", input.clientId);
	url.searchParams.set("redirect_uri", input.redirectUri);
	url.searchParams.set("scope", (input.scopes ?? DEFAULT_SCOPES).join(" "));
	url.searchParams.set("state", input.state);
	url.searchParams.set("code_challenge", input.challenge);
	url.searchParams.set("code_challenge_method", "S256");
	return url.toString();
}

/** Exchanges an authorization code for tokens with HTTP Basic client auth. */
export async function exchangeCode(
	metadata: OidcMetadata,
	input: {
		clientId: string;
		clientSecret: string;
		code: string;
		codeVerifier: string;
		redirectUri: string;
	},
): Promise<{ idToken: string }> {
	let response = await fetch(metadata.token_endpoint, {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/x-www-form-urlencoded",
			authorization: `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`,
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code: input.code,
			redirect_uri: input.redirectUri,
			code_verifier: input.codeVerifier,
		}),
	});
	let data = (await response.json()) as { id_token?: string; error?: string };
	if (!response.ok || !data.id_token) throw new Error(data.error ?? "Token exchange failed");
	return { idToken: data.id_token };
}

/** The authenticated profile extracted from a validated ID token. */
export interface OidcProfile {
	subject: string;
	email: string;
	displayName: string | null;
}

/** Validates the ID token's claims and extracts the profile. */
export function verifyIdToken(
	idToken: string,
	expected: { issuer: string; clientId: string },
): OidcProfile {
	let parts = idToken.split(".");
	if (parts.length !== 3 || !parts[1]) throw new Error("Malformed ID token");
	let claims = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1]))) as {
		iss?: string;
		aud?: string | string[];
		exp?: number;
		sub?: string;
		email?: string;
		name?: string;
	};

	if (claims.iss && claims.iss.replace(/\/+$/, "") !== expected.issuer.replace(/\/+$/, "")) {
		throw new Error("Issuer mismatch");
	}
	let audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
	if (audiences.length > 0 && !audiences.includes(expected.clientId))
		throw new Error("Audience mismatch");
	if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now())
		throw new Error("Token expired");
	if (!claims.sub) throw new Error("Missing subject");

	return { subject: claims.sub, email: claims.email ?? "", displayName: claims.name ?? null };
}

function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(value: string): Uint8Array {
	let padded = value.replace(/-/g, "+").replace(/_/g, "/");
	while (padded.length % 4) padded += "=";
	let binary = atob(padded);
	let bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
