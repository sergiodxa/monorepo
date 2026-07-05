import { redirect } from "@pkg/http/response";
import { env } from "cloudflare:workers";
import { createAction, createController } from "remix/fetch-router";

import { clearSession, getSessionData, updateSessionData } from "~/app/http/middleware/session";
import { platformDb } from "~/app/lib/db";
import {
	buildAuthorizationUrl,
	createPkce,
	discover,
	exchangeCode,
	verifyIdToken,
} from "~/app/lib/oidc";
import Account from "~/app/models/account";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/** `/auth/login` — sign-in screen (GET) and OIDC flow start (POST). */
export const login = createController(routes.auth.login, {
	actions: {
		async index(ctx) {
			return ctx.render(
				<Page title="Sign in">
					<h1>Sign in</h1>
					<form method="post" action="/auth/login">
						<button mix={[s.button]} type="submit">
							Continue with SSO
						</button>
					</form>
				</Page>,
			);
		},

		async action(ctx) {
			let metadata = await discover(env.OIDC_ISSUER);
			let pkce = await createPkce();
			let state = crypto.randomUUID();
			updateSessionData({ auth: { state, codeVerifier: pkce.verifier } });

			let url = buildAuthorizationUrl(metadata, {
				clientId: env.OIDC_CLIENT_ID,
				redirectUri: new URL("/auth/callback", ctx.request.url).toString(),
				state,
				challenge: pkce.challenge,
			});
			return redirect(url, { status: redirect.Status.SeeOther });
		},
	},
});

/** GET /auth/callback — completes login and creates the dashboard session. */
export const callback = createAction(routes.auth.callback, async (ctx) => {
	let url = new URL(ctx.request.url);
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
		redirectUri: new URL("/auth/callback", ctx.request.url).toString(),
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

/** `/auth/logout` — clears the session and redirects through the IdP logout. */
export const logout_ = createController(routes.auth.logout, {
	actions: {
		async action(ctx) {
			let idToken = getSessionData().idToken;
			clearSession();
			let origin = new URL(ctx.request.url).origin;
			let metadata = await discover(env.OIDC_ISSUER).catch(() => null);
			if (metadata?.end_session_endpoint) {
				let logoutUrl = new URL(metadata.end_session_endpoint);
				if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
				logoutUrl.searchParams.set("post_logout_redirect_uri", `${origin}/`);
				return redirect(logoutUrl.toString(), { status: redirect.Status.SeeOther });
			}
			return redirect("/", { status: redirect.Status.SeeOther });
		},
	},
});
