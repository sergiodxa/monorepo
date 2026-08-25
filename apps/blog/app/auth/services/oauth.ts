/**
 * OAuth/OIDC service for authenticating against the sergiodxa auth server. It
 * exposes `createProvider` to build a configured OIDC auth provider with the
 * issuer's endpoints and scopes, and `exchangeCodeForIdToken` to trade an
 * authorization code plus PKCE verifier for an ID token. Exists to centralize
 * the app's OAuth login flow and its shared credential/input contracts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OIDCAuthProfile } from "remix/auth";

import { createOIDCAuthProvider } from "remix/auth";

/**
 * Result returned after a successful OAuth authorization code exchange.
 */
export interface FinishedAuth {
	idToken: string;
	returnTo?: string;
}

/**
 * OAuth-related input contracts shared by this service.
 */
export namespace OAuthService {
	/**
	 * Client credentials used to authenticate OAuth requests.
	 */
	export interface AuthConfig {
		clientId: string;
		clientSecret: string;
	}

	/**
	 * Input required to create the OIDC provider instance.
	 */
	export interface ProviderInput {
		auth: AuthConfig;
		redirectUri: string;
	}

	/**
	 * Input required to exchange an authorization code for an ID token.
	 */
	export interface TokenExchangeInput {
		auth: AuthConfig;
		code: string;
		/** PKCE verifier that matches the original code challenge. */
		codeVerifier: string;
		redirectUri: string;
	}
}

/**
 * Builds the OIDC provider configuration for sergiodxa auth.
 *
 * @param input Provider settings for client credentials and callback URL.
 * @returns Configured OIDC auth provider instance.
 */
export function createProvider(input: OAuthService.ProviderInput) {
	return createOIDCAuthProvider<OIDCAuthProfile, "sergiodxa">({
		name: "sergiodxa",
		issuer: "auth.sergiodxa.com",
		clientId: input.auth.clientId,
		clientSecret: input.auth.clientSecret,
		redirectUri: input.redirectUri,
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

/**
 * Exchanges an OAuth authorization code for an ID token.
 *
 * @param input Authorization code, PKCE verifier, and client credentials.
 * @returns ID token payload used to finalize the session.
 */
export async function exchangeCodeForIdToken(
	input: OAuthService.TokenExchangeInput,
): Promise<FinishedAuth> {
	let payload = new URLSearchParams({
		grant_type: "authorization_code",
		code: input.code,
		redirect_uri: input.redirectUri,
		code_verifier: input.codeVerifier,
	});

	let response = await fetch("https://auth.sergiodxa.com/oauth/token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${btoa(`${input.auth.clientId}:${input.auth.clientSecret}`)}`,
		},
		body: payload,
	});

	let data = (await response.json()) as { id_token?: string; error?: string };

	if (!response.ok || !data.id_token) {
		throw new Error(data.error ?? "OAuth token exchange failed");
	}

	return {
		idToken: data.id_token,
	};
}
