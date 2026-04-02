import type { OIDCAuthProfile } from "remix/auth";
import type { RequestContext } from "remix/fetch-router";

import { env } from "cloudflare:workers";
import { createOIDCAuthProvider, startExternalAuth } from "remix/auth";
import { Session } from "remix/session";

import type { WithDB } from "~/middleware/db";
import type { WithSession } from "~/middleware/session";

import routes from "~/routes";

interface OAuthTransaction {
	provider: string;
	state: string;
	codeVerifier: string;
	returnTo?: string;
}

export interface FinishedAuth {
	idToken: string;
	returnTo?: string;
}

type OAuthContext = WithSession<WithDB<RequestContext>>;

function provider(context: RequestContext<any, any>) {
	return createOIDCAuthProvider<OIDCAuthProfile, "sergiodxa">({
		name: "sergiodxa",
		issuer: "auth.sergiodxa.com",
		clientId: env.CLIENT_ID,
		clientSecret: env.CLIENT_SECRET,
		redirectUri: new URL(routes.auth.callback.href(), context.request.url),
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

export function startAuth(context: RequestContext<any, any>) {
	let returnTo = context.url.searchParams.get("next");
	return startExternalAuth(provider(context), context, { returnTo });
}

export async function finishAuth(context: RequestContext<any, any>): Promise<FinishedAuth> {
	let ctx = context as OAuthContext;
	if (!ctx.has(Session)) {
		throw new Error("Session not found in auth callback");
	}

	let session = ctx.get(Session);
	let transaction = session.get("__auth") as OAuthTransaction | null;
	let callbackError = ctx.url.searchParams.get("error");
	if (callbackError) {
		throw new Error(ctx.url.searchParams.get("error_description") ?? callbackError);
	}

	if (!transaction || transaction.provider !== "sergiodxa") {
		throw new Error("Missing OAuth transaction");
	}

	let state = ctx.url.searchParams.get("state");
	let code = ctx.url.searchParams.get("code");
	if (!state || !code) {
		session.unset("__auth");
		throw new Error("Missing OAuth state/code");
	}

	if (state !== transaction.state) {
		session.unset("__auth");
		throw new Error("Invalid OAuth state");
	}

	let callbackUrl = new URL(routes.auth.callback.href(), ctx.request.url);
	let payload = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: callbackUrl.toString(),
		code_verifier: transaction.codeVerifier,
	});

	let response = await fetch("https://auth.sergiodxa.com/oauth/token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${btoa(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`)}`,
		},
		body: payload,
	});

	let data = (await response.json()) as { id_token?: string; error?: string };
	session.unset("__auth");

	if (!response.ok || !data.id_token) {
		throw new Error(data.error ?? "OAuth token exchange failed");
	}

	return {
		idToken: data.id_token,
		returnTo: transaction.returnTo,
	};
}
