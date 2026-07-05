import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import { env } from "cloudflare:workers";

import { clearSession, getSessionData, updateSessionData } from "~/app/http/middleware/session";
import action from "~/app/lib/action";
import { platformDb } from "~/app/lib/db";
import {
	buildAuthorizationUrl,
	createPkce,
	discover,
	exchangeCode,
	verifyIdToken,
} from "~/app/lib/oidc";
import { renderDocument } from "~/app/lib/render";
import Account from "~/app/models/account";
import { Page } from "~/app/views/layout";

/** GET /auth/login — sign-in screen. */
export const loginIndex = action<"GET", "/auth/login">(async () => {
	let body = await renderDocument(
		<Page title="Sign in">
			<h1>Sign in</h1>
			<form method="post" action="/auth/login">
				<button type="submit">Continue with SSO</button>
			</form>
		</Page>,
	);
	return ok(body);
});

/** POST /auth/login — starts the OIDC authorization-code + PKCE flow. */
export const loginStart = action<"POST", "/auth/login">(async ({ request }) => {
	let metadata = await discover(env.OIDC_ISSUER);
	let pkce = await createPkce();
	let state = crypto.randomUUID();
	updateSessionData({ auth: { state, codeVerifier: pkce.verifier } });

	let url = buildAuthorizationUrl(metadata, {
		clientId: env.OIDC_CLIENT_ID,
		redirectUri: new URL("/auth/callback", request.url).toString(),
		state,
		challenge: pkce.challenge,
	});
	return redirect(url, { status: redirect.Status.SeeOther });
});

/** GET /auth/callback — completes login and creates the dashboard session. */
export const callback = action<"GET", "/auth/callback">(async ({ request }) => {
	let url = new URL(request.url);
	let transaction = getSessionData().auth;
	if (!transaction) return redirect("/auth/login", { status: redirect.Status.SeeOther });

	let state = url.searchParams.get("state");
	let code = url.searchParams.get("code");
	if (!state || !code || state !== transaction.state) {
		return redirect("/auth/login", { status: redirect.Status.SeeOther });
	}

	let metadata = await discover(env.OIDC_ISSUER);
	let { idToken } = await exchangeCode(metadata, {
		clientId: env.OIDC_CLIENT_ID,
		clientSecret: env.OIDC_CLIENT_SECRET,
		code,
		codeVerifier: transaction.codeVerifier,
		redirectUri: new URL("/auth/callback", request.url).toString(),
	});
	let profile = verifyIdToken(idToken, { issuer: env.OIDC_ISSUER, clientId: env.OIDC_CLIENT_ID });

	let account = await Account.findOrCreateFromProfile(platformDb(), {
		subject: profile.subject,
		email: profile.email,
		displayName: profile.displayName,
	});
	updateSessionData({ accountId: account.id, idToken, auth: undefined });
	return redirect("/dashboard", { status: redirect.Status.SeeOther });
});

/** POST /auth/logout — clears the session and redirects through the IdP logout. */
export const logoutAction = action<"POST", "/auth/logout">(async ({ request }) => {
	let idToken = getSessionData().idToken;
	clearSession();
	let origin = new URL(request.url).origin;
	let metadata = await discover(env.OIDC_ISSUER).catch(() => null);
	if (metadata?.end_session_endpoint) {
		let logoutUrl = new URL(metadata.end_session_endpoint);
		if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
		logoutUrl.searchParams.set("post_logout_redirect_uri", `${origin}/`);
		return redirect(logoutUrl.toString(), { status: redirect.Status.SeeOther });
	}
	return redirect("/", { status: redirect.Status.SeeOther });
});
