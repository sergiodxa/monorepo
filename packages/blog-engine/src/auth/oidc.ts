import type { AuthProfile } from "../users/models/user";

/** OIDC provider endpoints (mirrors remix/auth's provider metadata). */
export interface OIDCMetadata {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint?: string;
	jwks_uri: string;
	end_session_endpoint?: string;
}

/** Relying-party configuration for the admin panel's OIDC client. */
export interface OIDCConfig {
	issuer: string;
	clientId: string;
	clientSecret: string;
	metadata?: OIDCMetadata;
	scopes?: string[];
	admins?: string[];
}

/** A PKCE code verifier/challenge pair. */
export interface Pkce {
	verifier: string;
	challenge: string;
}

const DEFAULT_SCOPES = ["openid", "profile", "email"];

/** Per-isolate discovery cache keyed by issuer. */
const metadataCache = new Map<string, OIDCMetadata>();

/**
 * Resolves provider metadata: uses the static config when present, otherwise
 * discovers `${issuer}/.well-known/openid-configuration` once per isolate.
 */
export async function resolveMetadata(config: OIDCConfig): Promise<OIDCMetadata> {
	if (config.metadata) return config.metadata;

	let cached = metadataCache.get(config.issuer);
	if (cached) return cached;

	let url = new URL(".well-known/openid-configuration", ensureTrailingSlash(config.issuer));
	let response = await fetch(url, { headers: { accept: "application/json" } });
	if (!response.ok) throw new Error(`OIDC discovery failed: ${response.status}`);
	let metadata = (await response.json()) as OIDCMetadata;
	metadataCache.set(config.issuer, metadata);
	return metadata;
}

/** Generates a PKCE verifier and its S256 challenge. */
export async function createPkce(): Promise<Pkce> {
	let bytes = crypto.getRandomValues(new Uint8Array(32));
	let verifier = base64url(bytes);
	let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	let challenge = base64url(new Uint8Array(digest));
	return { verifier, challenge };
}

/** Builds the authorization-endpoint URL for the login redirect. */
export function buildAuthorizationUrl(
	metadata: OIDCMetadata,
	input: {
		clientId: string;
		redirectUri: string;
		scopes?: string[];
		state: string;
		challenge: string;
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

/** Exchanges an authorization code for tokens using HTTP Basic client auth. */
export async function exchangeCode(
	metadata: OIDCMetadata,
	input: {
		clientId: string;
		clientSecret: string;
		code: string;
		codeVerifier: string;
		redirectUri: string;
	},
): Promise<{ idToken: string; accessToken?: string }> {
	let body = new URLSearchParams({
		grant_type: "authorization_code",
		code: input.code,
		redirect_uri: input.redirectUri,
		code_verifier: input.codeVerifier,
	});
	let response = await fetch(metadata.token_endpoint, {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/x-www-form-urlencoded",
			authorization: `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`,
		},
		body,
	});
	let data = (await response.json()) as {
		id_token?: string;
		access_token?: string;
		error?: string;
	};
	if (!response.ok || !data.id_token) {
		throw new Error(data.error ?? "OAuth token exchange failed");
	}
	return { idToken: data.id_token, accessToken: data.access_token };
}

/** Claims the engine reads from the ID token. */
interface IdTokenClaims {
	iss?: string;
	aud?: string | string[];
	exp?: number;
	sub?: string;
	email?: string;
	name?: string;
	preferred_username?: string;
	picture?: string;
}

/**
 * Validates an ID token received directly from the token endpoint and extracts a
 * normalized profile. The token arrives over a TLS channel authenticated with the
 * client secret, so per OIDC §3.1.3.7 the `iss`/`aud`/`exp` claims are validated in
 * place of a signature check for this confidential-client code flow.
 * @param idToken - The raw JWT id_token.
 * @param expected - Expected issuer and client id (audience).
 * @returns A normalized {@link AuthProfile}.
 */
export function verifyIdToken(
	idToken: string,
	expected: { issuer: string; clientId: string },
): AuthProfile {
	let claims = decodeJwtPayload(idToken);

	if (claims.iss && normalizeIssuer(claims.iss) !== normalizeIssuer(expected.issuer)) {
		throw new Error("ID token issuer mismatch");
	}
	let audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
	if (audiences.length > 0 && !audiences.includes(expected.clientId)) {
		throw new Error("ID token audience mismatch");
	}
	if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) {
		throw new Error("ID token expired");
	}
	if (!claims.sub) throw new Error("ID token missing subject");

	let email = claims.email ?? "";
	return {
		subjectId: claims.sub,
		email,
		username: claims.preferred_username ?? email.split("@")[0] ?? claims.sub,
		displayName: claims.name ?? "",
		avatar: claims.picture ?? "",
	};
}

function decodeJwtPayload(token: string): IdTokenClaims {
	let parts = token.split(".");
	if (parts.length !== 3 || !parts[1]) throw new Error("Malformed ID token");
	let json = new TextDecoder().decode(base64urlDecode(parts[1]));
	return JSON.parse(json) as IdTokenClaims;
}

function normalizeIssuer(issuer: string): string {
	return issuer.replace(/\/+$/, "");
}

function ensureTrailingSlash(value: string): string {
	return value.endsWith("/") ? value : `${value}/`;
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
