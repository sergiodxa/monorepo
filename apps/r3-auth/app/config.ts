/**
 * Static configuration for the OAuth 2.0 / OpenID Connect authorization server.
 * Declares the identity the server presents to relying parties — its own client
 * registration, the issuer, token lifetimes, supported scopes — and builds the public
 * discovery document every client reads to learn the endpoints and capabilities.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK } from "@edgefirst-dev/jwt";
import { toMs } from "@pkg/duration";

/** Display name of the authorization server's own OAuth client registration. */
export const AUTH_SERVER_NAME = "Auth by Sergio Xalambrí";

/**
 * Client id of the authorization server's own registration, used when the server
 * signs a person in to its own account area. Frozen: the row already exists in
 * production under this id and relying parties' sessions reference it.
 */
export const AUTH_SERVER_CLIENT_ID = "d12d3901-3cbe-468b-adf5-ac3d3e015728";

/**
 * The `iss` claim written into every ID and access token, and the `issuer`
 * advertised by discovery.
 *
 * Frozen and deliberately scheme-less: relying parties compare this exact string
 * when they verify an ID token, so adding the scheme would reject every token they
 * receive. Changing it is a coordinated client release, not a server decision.
 */
export const ISSUER = "auth.sergiodxa.com";

/**
 * Origin every published endpoint URL is built against. Separate from {@link ISSUER}
 * because the issuer string carries no scheme and a URL needs one.
 */
const ISSUER_HOST = "https://auth.sergiodxa.com";

/** Lifetime of an issued ID token, in milliseconds for `Date` arithmetic. */
export const ID_TOKEN_TTL = toMs("1 hour");

/** Lifetime of an issued access token, in milliseconds for `Date` arithmetic. */
export const ACCESS_TOKEN_TTL = toMs("1 hour");

/**
 * Lifetime of an authorization code, in milliseconds. Kept at the maximum RFC 6749
 * recommends, since a code is redeemed immediately after the redirect.
 */
export const AUTHZ_CODE_TTL = toMs("10 minutes");

/**
 * Scopes this server understands. `openid` is required by OIDC and carries `sub`,
 * `email` adds the email claims, and `profile` adds name, username and picture.
 */
export const SCOPES_SUPPORTED = ["openid", "email", "profile"] as const;

/** One of the scopes this server accepts on an authorization request. */
export type SupportedScope = (typeof SCOPES_SUPPORTED)[number];

/**
 * The public description of how to connect to and use this authorization server,
 * served at both `.well-known` discovery paths.
 *
 * Some entries are purely informational for clients, but the endpoint URLs are also
 * the server's own record of where each endpoint lives, so a route move must be
 * reflected here or discovery starts lying.
 */
export const WELL_KNOWN = {
	issuer: ISSUER,
	authorization_endpoint: new URL("/authorize", ISSUER_HOST),
	claims_supported: [
		// Standard JWT claims
		"aud",
		"exp",
		"iat",
		"iss",
		"sub",
		// OIDC Core claims
		"auth_time",
		"nonce",
		// email scope
		"email",
		"email_verified",
		// profile scope
		"name",
		"preferred_username",
		"picture",
	],
	code_challenge_methods_supported: ["S256", "plain"],
	grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
	id_token_signing_alg_values_supported: [JWK.Algoritm.ES256],
	jwks_uri: new URL("/.well-known/jwks.json", ISSUER_HOST),
	request_parameter_supported: false,
	request_uri_parameter_supported: false,
	response_modes_supported: ["query", "fragment", "form_post"],
	response_types_supported: ["code"],
	// OIDC Prompt Values, including `create` from OIDC Prompt Create 1.0
	prompt_values_supported: ["none", "login", "consent", "select_account", "create"],
	revocation_endpoint: new URL("/oauth/revoke", ISSUER_HOST),
	revocation_endpoint_auth_methods_supported: ["client_secret_basic"],
	introspection_endpoint: new URL("/oauth/introspect", ISSUER_HOST),
	introspection_endpoint_auth_methods_supported: ["client_secret_basic"],
	scopes_supported: SCOPES_SUPPORTED,
	subject_types_supported: ["public"],
	authorization_response_iss_parameter_supported: true,
	token_endpoint_auth_methods_supported: ["client_secret_basic"],
	token_endpoint: new URL("/oauth/token", ISSUER_HOST),
	userinfo_endpoint: new URL("/userinfo", ISSUER_HOST),
	end_session_endpoint: new URL("/oidc/logout", ISSUER_HOST),
	// OIDC Back-Channel Logout 1.0
	backchannel_logout_supported: true,
	backchannel_logout_session_supported: true,
	// OIDC Front-Channel Logout 1.0
	frontchannel_logout_supported: true,
	frontchannel_logout_session_supported: true,
	// OIDC Session Management 1.0
	check_session_iframe: new URL("/oidc/check-session", ISSUER_HOST),
};
