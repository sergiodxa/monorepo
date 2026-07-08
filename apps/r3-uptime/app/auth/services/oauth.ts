/**
 * OIDC provider configuration for authenticating against auth.sergiodxa.com. Builds a
 * `remix/auth` OIDC provider with explicit endpoint metadata (discovery is skipped) so
 * `startExternalAuth`/`finishExternalAuth` can drive the PKCE authorization-code flow.
 * Exists to centralize the app's single external identity provider configuration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OIDCAuthProfile } from "remix/auth";

import { createOIDCAuthProvider } from "remix/auth";

/**
 * Builds the OIDC provider for auth.sergiodxa.com.
 *
 * @param options.clientId OAuth client id registered with the auth server.
 * @param options.clientSecret OAuth client secret registered with the auth server.
 * @param options.redirectUri Absolute callback URL registered with the auth server.
 */
export function createAuthProvider(options: {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}) {
	return createOIDCAuthProvider<OIDCAuthProfile, "sergiodxa">({
		name: "sergiodxa",
		issuer: "auth.sergiodxa.com",
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		redirectUri: options.redirectUri,
		metadata: {
			issuer: "auth.sergiodxa.com",
			authorization_endpoint: "https://auth.sergiodxa.com/authorize",
			token_endpoint: "https://auth.sergiodxa.com/oauth/token",
			userinfo_endpoint: "https://auth.sergiodxa.com/userinfo",
			jwks_uri: "https://auth.sergiodxa.com/.well-known/jwks.json",
			end_session_endpoint: "https://auth.sergiodxa.com/oidc/logout",
		},
		scopes: ["openid", "profile", "email"],
	});
}
