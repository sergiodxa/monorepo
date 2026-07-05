/**
 * The auth controllers implementing the dashboard's OIDC login flow: the sign-in and
 * sign-out screens, the authorization-code start (with PKCE + state stored in the
 * session), and the callback that verifies the ID token and creates the session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { redirect } from "@pkg/http/response";
import {
	buildAuthorizationUrl,
	createPkce,
	discover,
	exchangeCode,
	verifyIdToken,
} from "@pkg/oidc-client";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction, createController } from "remix/fetch-router";

import { clearSession, getSessionData, updateSessionData } from "~/app/http/middleware/session";
import Account from "~/app/models/account";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/**
 * `/auth/login` controller: renders the sign-in screen on `GET` and, on `POST`,
 * starts the OIDC authorization-code flow — creating a PKCE pair and state, saving
 * them in the session, and redirecting to the IdP.
 *
 * @returns The sign-in page (`index`) or a redirect to the IdP (`action`).
 */
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

/**
 * `GET /auth/callback` controller: completes the OIDC flow. Validates the returned
 * state against the stored transaction, exchanges the code, verifies the ID token,
 * upserts the local account, and establishes the dashboard session.
 *
 * @returns A redirect to `/dashboard` on success, or back to `/auth/login` if the
 *   transaction is missing or the state/code check fails.
 */
export const callback = createAction(
	routes.auth.callback,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
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

		let account = await Account.findOrCreateFromProfile(db, {
			subject: profile.subject,
			email: profile.email,
			displayName: profile.displayName,
		});
		updateSessionData({ accountId: account.id, idToken, auth: undefined });
		return redirect("/dashboard", { status: redirect.Status.SeeOther });
	}),
);

/**
 * `/auth/logout` controller: renders the sign-out confirmation on `GET` and, on
 * `POST`, clears the session and redirects through the IdP's end-session endpoint
 * (falling back to `/` when the IdP advertises none).
 *
 * @returns The sign-out page (`index`) or a logout redirect (`action`).
 */
export const logout_ = createController(routes.auth.logout, {
	actions: {
		async index(ctx) {
			return ctx.render(
				<Page title="Sign out">
					<h1>Sign out</h1>
					<form method="post" action="/auth/logout">
						<button mix={[s.button]} type="submit">
							Sign out
						</button>
					</form>
				</Page>,
			);
		},

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
