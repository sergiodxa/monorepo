import type { OIDCAuthProfile } from "remix/auth";

import { createOIDCAuthProvider } from "remix/auth";

export interface FinishedAuth {
	idToken: string;
	returnTo?: string;
}

export namespace OAuthService {
	export interface AuthConfig {
		clientId: string;
		clientSecret: string;
	}

	export interface ProviderInput {
		auth: AuthConfig;
		redirectUri: string;
	}

	export interface TokenExchangeInput {
		auth: AuthConfig;
		code: string;
		codeVerifier: string;
		redirectUri: string;
	}
}

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
