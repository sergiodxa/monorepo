import { JWK } from "@edgefirst-dev/jwt";
import ms from "ms";

export const AUTH_SERVER_NAME = "Auth by Sergio Xalambrí";
export const AUTH_SERVER_CLIENT_ID = "d12d3901-3cbe-468b-adf5-ac3d3e015728";
export const ISSUER = "auth.sergiodxa.com";
const ISSUER_HOST = "https://auth.sergiodxa.com";
export const ID_TOKEN_TTL = ms("1 hour");
export const ACCESS_TOKEN_TTL = ms("1 hour");
export const AUTHZ_CODE_TTL = ms("10 minutes"); // RFC 6749 recommends max 10 minutes

/**
 * Supported OAuth 2.0 / OIDC scopes
 * - openid: Required for OIDC, includes sub claim
 * - email: email, email_verified claims
 * - profile: name, preferred_username, picture claims
 */
export const SCOPES_SUPPORTED = ["openid", "email", "profile"] as const;
export type SupportedScope = (typeof SCOPES_SUPPORTED)[number];

/**
 * This is the public information about how to connect and use the Authorization
 * Server, while most of these configurations are only for the clients to know
 * how to connect to the server, some of them are also used by the server
 * itself to configure the server, particularly the endpoints.
 */
export const WELL_KNOWN = {
	issuer: ISSUER,
	authorization_endpoint: new URL("/authorize", ISSUER_HOST),
	claims_supported: ["aud", "exp", "iat", "iss", "sub", "email"],
	code_challenge_methods_supported: ["S256", "plain"],
	grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
	id_token_signing_alg_values_supported: [JWK.Algoritm.ES256],
	jwks_uri: new URL("/.well-known/jwks.json", ISSUER_HOST),
	request_parameter_supported: false,
	request_uri_parameter_supported: false,
	response_modes_supported: ["query"],
	response_types_supported: ["code"],
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
