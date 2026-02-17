import { JWK } from "@edgefirst-dev/jwt";
import ms from "ms";

export const AUTH_SERVER_NAME = "Auth by Sergio Xalambrí";
export const AUTH_SERVER_CLIENT_ID = "d12d3901-3cbe-468b-adf5-ac3d3e015728";
export const ISSUER = "auth.sergiodxa.com";
const ISSUER_HOST = "https://auth.sergiodxa.com";
export const ID_TOKEN_TTL = ms("1 hour");
export const ACCESS_TOKEN_TTL = ms("1 hour");

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
	id_token_signing_alg_values_supported: [JWK.Algoritm.ES256],
	jwks_uri: new URL("/.well-known/jwks.json", ISSUER_HOST),
	registration_endpoint: new URL("/oidc/register", ISSUER_HOST),
	request_parameter_supported: false,
	request_uri_parameter_supported: false,
	response_modes_supported: ["query"],
	response_types_supported: ["code", "token"],
	revocation_endpoint: new URL("/oauth/revoke", ISSUER_HOST),
	scopes_supported: ["openid", "email"],
	subject_types_supported: ["public"],
	token_endpoint_auth_methods_supported: ["client_secret_basic"],
	token_endpoint: new URL("/oauth/token", ISSUER_HOST),
	token_introspection_endpoint: new URL("/oauth/introspect", ISSUER_HOST),
	userinfo_endpoint: new URL("/userinfo", ISSUER_HOST),
	end_session_endpoint: new URL("/oidc/logout", ISSUER_HOST),
};
