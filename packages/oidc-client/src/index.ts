/**
 * OpenID Connect relying-party helpers shared across the SaaS platform.
 *
 * Two layers live here. The **standalone helpers** ({@link discover},
 * {@link createPkce}, {@link buildAuthorizationUrl}, {@link exchangeCode},
 * {@link verifyIdToken}) drive a confidential-client authorization-code flow with
 * PKCE by hand — the dashboard uses them directly. The **`remix/auth` adapter**
 * ({@link createProvider}, {@link resolveEndSessionEndpoint}, {@link toAuthProfile})
 * wraps `remix/auth`'s OIDC provider for consumers that prefer its
 * `startExternalAuth`/`finishExternalAuth` machinery (the blog engine's admin panel).
 *
 * The ID token is received directly from the token endpoint over TLS with client
 * authentication, so per OIDC §3.1.3.7 {@link verifyIdToken} validates the
 * `iss`/`aud`/`exp`/`sub` claims in place of a signature check for this
 * confidential-client authorization-code flow — TLS provides the transport trust.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { OIDCAuthProfile, OIDCAuthProviderMetadata } from "remix/auth";

import { createOIDCAuthProvider } from "remix/auth";

// ---------------------------------------------------------------------------
// Standalone relying-party helpers
// ---------------------------------------------------------------------------

/** The default OAuth scopes requested when a caller does not specify any. */
const DEFAULT_SCOPES = ["openid", "profile", "email"];

/** Provider metadata subset the standalone helpers need. */
export interface OidcMetadata {
	authorization_endpoint: string;
	token_endpoint: string;
	end_session_endpoint?: string;
}

/**
 * Per-isolate cache of discovered metadata, keyed by issuer. Discovery documents
 * are effectively static, so caching avoids a round-trip on every login.
 */
const metadataCache = new Map<string, OidcMetadata>();

/**
 * Discovers provider metadata from `${issuer}/.well-known/openid-configuration`.
 * The result is cached per issuer for the lifetime of the isolate.
 *
 * @param issuer - The OIDC issuer base URL (trailing slash optional).
 * @returns The discovered {@link OidcMetadata}.
 * @throws {Error} When the discovery document responds with a non-2xx status.
 * @example
 * ```ts
 * let metadata = await discover("https://sso.blog.sergiodxa.com");
 * ```
 */
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

/**
 * Generates a PKCE verifier and its S256 (SHA-256, base64url) challenge.
 *
 * @returns A {@link Pkce} pair: keep `verifier` in the session, send `challenge`
 *   on the authorization request.
 * @example
 * ```ts
 * let pkce = await createPkce();
 * // store pkce.verifier server-side; send pkce.challenge to the IdP
 * ```
 */
export async function createPkce(): Promise<Pkce> {
	let bytes = crypto.getRandomValues(new Uint8Array(32));
	let verifier = base64url(bytes);
	let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/**
 * Builds the authorization redirect URL for the authorization-code + PKCE flow.
 *
 * @param metadata - Discovered provider metadata (see {@link discover}).
 * @param input - The authorization request parameters.
 * @param input.clientId - The relying-party client id.
 * @param input.redirectUri - The absolute callback URL registered with the IdP.
 * @param input.state - Opaque CSRF/state value echoed back on the callback.
 * @param input.challenge - The PKCE S256 challenge from {@link createPkce}.
 * @param input.scopes - Requested scopes. Defaults to `openid profile email`.
 * @returns The fully-qualified authorization URL to redirect the browser to.
 * @example
 * ```ts
 * let url = buildAuthorizationUrl(metadata, {
 * 	clientId,
 * 	redirectUri: "https://app.example.com/auth/callback",
 * 	state,
 * 	challenge: pkce.challenge,
 * });
 * ```
 */
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

/**
 * Exchanges an authorization code for tokens using HTTP Basic client
 * authentication (confidential client).
 *
 * @param metadata - Discovered provider metadata (see {@link discover}).
 * @param input - The token request parameters.
 * @param input.clientId - The relying-party client id.
 * @param input.clientSecret - The relying-party client secret.
 * @param input.code - The authorization code returned on the callback.
 * @param input.codeVerifier - The PKCE verifier stored at authorization time.
 * @param input.redirectUri - The same callback URL used to obtain `code`.
 * @returns The raw `id_token` string, ready for {@link verifyIdToken}.
 * @throws {Error} When the token endpoint errors or omits `id_token`.
 * @example
 * ```ts
 * let { idToken } = await exchangeCode(metadata, {
 * 	clientId,
 * 	clientSecret,
 * 	code,
 * 	codeVerifier: transaction.codeVerifier,
 * 	redirectUri,
 * });
 * ```
 */
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

/**
 * Validates an ID token's claims and extracts the authenticated profile.
 *
 * The signature is **not** verified: the token was received directly from the
 * token endpoint over TLS with client authentication, so per OIDC §3.1.3.7 the
 * mandatory `iss`/`aud`/`exp`/`sub` claims are validated in place of a signature
 * check for this confidential-client authorization-code flow. A token missing any
 * of these is rejected rather than silently accepted.
 *
 * @param idToken - The compact JWS ID token returned by {@link exchangeCode}.
 * @param expected - The values the token must match.
 * @param expected.issuer - The expected issuer (trailing slashes ignored).
 * @param expected.clientId - The expected audience (this relying party).
 * @returns The validated {@link OidcProfile}.
 * @throws {Error} When the token is malformed or any claim fails validation
 *   (`Malformed ID token`, `Issuer mismatch`, `Audience mismatch`,
 *   `Token expired or missing expiration`, `Missing subject`).
 * @example
 * ```ts
 * let profile = verifyIdToken(idToken, { issuer, clientId });
 * // profile.subject, profile.email, profile.displayName
 * ```
 */
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

	// Require iss/aud/exp/sub — a token missing any of these must be rejected, not
	// silently accepted (per OIDC §3.1.3.7, these are mandatory ID-token claims).
	if (!claims.iss || claims.iss.replace(/\/+$/, "") !== expected.issuer.replace(/\/+$/, "")) {
		throw new Error("Issuer mismatch");
	}
	let audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
	if (audiences.length === 0 || !audiences.includes(expected.clientId)) {
		throw new Error("Audience mismatch");
	}
	if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) {
		throw new Error("Token expired or missing expiration");
	}
	if (!claims.sub) throw new Error("Missing subject");

	return { subject: claims.sub, email: claims.email ?? "", displayName: claims.name ?? null };
}

// ---------------------------------------------------------------------------
// `remix/auth` OIDC adapter
// ---------------------------------------------------------------------------

/** OIDC provider discovery metadata (re-exported from `remix/auth`). */
export type OIDCMetadata = OIDCAuthProviderMetadata;

/** Relying-party configuration for the `remix/auth` OIDC adapter. */
export interface OIDCConfig {
	issuer: string;
	clientId: string;
	clientSecret: string;
	/** Inline discovery metadata; when omitted `remix/auth` discovers it from the issuer. */
	metadata?: OIDCMetadata;
	scopes?: string[];
	/** Emails or subject ids always mapped to the admin role on login. */
	admins?: string[];
}

/**
 * A normalized authentication profile: the OIDC claims mapped into the field
 * names the SaaS user models consume. Structurally matches the blog engine's
 * `AuthProfile`, so it can be re-exported and typed as that without conversion.
 */
export interface NormalizedAuthProfile {
	subjectId: string;
	email: string;
	avatar: string;
	username: string;
	displayName: string;
}

/**
 * Builds the `remix/auth` OIDC provider for a request. The redirect URI is
 * derived from the request so one build serves any hostname; `startExternalAuth`
 * and `finishExternalAuth` drive the PKCE flow against it.
 *
 * @param config - The relying-party configuration.
 * @param redirectUri - The absolute `/auth/callback` URL for this request's host.
 * @returns A configured `remix/auth` OIDC auth provider.
 * @example
 * ```ts
 * let provider = createProvider(ctx.oidc, callbackUri(ctx.request));
 * return startExternalAuth(provider, ctx);
 * ```
 */
export function createProvider(config: OIDCConfig, redirectUri: string) {
	return createOIDCAuthProvider({
		name: "oidc",
		issuer: config.issuer,
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		redirectUri,
		scopes: config.scopes,
		metadata: config.metadata,
	});
}

/** Per-isolate cache of discovered `end_session_endpoint`s, keyed by issuer. */
const endSessionCache = new Map<string, string | null>();

/**
 * Resolves the provider's `end_session_endpoint` (for `id_token_hint` logout)
 * from inline metadata or OIDC discovery. The discovered value is cached per
 * issuer for the lifetime of the isolate.
 *
 * @param config - The relying-party configuration.
 * @returns The end-session endpoint, or `null` when the provider offers none.
 * @example
 * ```ts
 * let endSession = await resolveEndSessionEndpoint(ctx.oidc);
 * if (endSession) redirect(endSession); // RP-initiated logout
 * ```
 */
export async function resolveEndSessionEndpoint(config: OIDCConfig): Promise<string | null> {
	let inline = (config.metadata as Record<string, unknown> | undefined)?.["end_session_endpoint"];
	if (typeof inline === "string") return inline;

	if (endSessionCache.has(config.issuer)) return endSessionCache.get(config.issuer) ?? null;
	let result: string | null = null;
	try {
		let base = config.issuer.endsWith("/") ? config.issuer : `${config.issuer}/`;
		let response = await fetch(new URL(".well-known/openid-configuration", base), {
			headers: { accept: "application/json" },
		});
		if (response.ok) {
			let meta = (await response.json()) as { end_session_endpoint?: string };
			result = meta.end_session_endpoint ?? null;
		}
	} catch {
		result = null;
	}
	endSessionCache.set(config.issuer, result);
	return result;
}

/**
 * Maps a `remix/auth` OIDC profile to the normalized profile the SaaS user
 * models consume. `username` falls back to the email local-part, then the
 * subject; `email` and `displayName` fall back to empty strings.
 *
 * @param profile - The raw OIDC profile from `remix/auth`.
 * @returns The {@link NormalizedAuthProfile}.
 * @example
 * ```ts
 * let user = await User.findOrCreateFromAuthProfile(db, toAuthProfile(result.profile));
 * ```
 */
export function toAuthProfile(profile: OIDCAuthProfile): NormalizedAuthProfile {
	let email = profile.email ?? "";
	return {
		subjectId: profile.sub,
		email,
		username: profile.preferred_username ?? email.split("@")[0] ?? profile.sub,
		displayName: profile.name ?? "",
		avatar: profile.picture ?? "",
	};
}

// ---------------------------------------------------------------------------
// base64url helpers
// ---------------------------------------------------------------------------

/**
 * Encodes bytes as an unpadded base64url string.
 * @param bytes - The bytes to encode.
 * @returns The base64url-encoded string.
 */
function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes an unpadded base64url string back into bytes.
 * @param value - The base64url-encoded string.
 * @returns The decoded bytes.
 */
function base64urlDecode(value: string): Uint8Array {
	let padded = value.replace(/-/g, "+").replace(/_/g, "/");
	while (padded.length % 4) padded += "=";
	let binary = atob(padded);
	let bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
