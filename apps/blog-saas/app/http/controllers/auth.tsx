/**
 * The auth controllers implementing the dashboard's OIDC login flow: the sign-in and
 * sign-out screens, the authorization-code start, the callback that verifies the ID
 * token and opens the session, and the RP-initiated sign-out that closes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { isFailure, wrap } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction, createController } from "remix/router";

import { relyingParty } from "~/app/auth/relying-party";
import { clearSession, setAccountId } from "~/app/http/middleware/session";
import Account from "~/app/models/account";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/**
 * `/auth/login` controller: renders the sign-in screen on `GET` and, on `POST`, starts
 * the OIDC authorization-code flow, which writes the login's `state`, PKCE verifier,
 * and `nonce` to the session before handing the browser to the provider.
 *
 * @returns The sign-in page (`index`) or a redirect to the provider (`action`).
 */
export const login = createController(routes.auth.login, {
	actions: {
		async index(ctx) {
			return ctx.render(
				<Page title="Sign in">
					<h1>Sign in</h1>
					<form method="post" action={routes.auth.login.action.href()}>
						<button mix={[s.button]} type="submit">
							Continue with SSO
						</button>
					</form>
				</Page>,
			);
		},

		async action(ctx) {
			return relyingParty(ctx.url).authorize(ctx, {
				returnTo: ctx.url.searchParams.get("returnTo"),
			});
		},
	},
});

/**
 * `GET /auth/callback` controller: completes the OIDC flow — correlating the callback
 * with the login it answers, exchanging the code, and verifying the ID token against
 * the provider's keys and the login's `nonce` — then opens the dashboard session.
 *
 * @returns A redirect to the login's destination, or back to `/auth/login` when the
 *   callback answers no login this session started.
 */
export const callback = createAction(
	routes.auth.callback,
	inject([Database] as const, async (db) => {
		let ctx = getContext();

		let completed = await wrap(async () => {
			let grant = await relyingParty(ctx.url).callback(ctx);
			let account = await Account.findOrCreateFromProfile(db, {
				subject: grant.subject,
				email: grant.profile.email ?? "",
				displayName: grant.profile.name,
			});
			setAccountId(account.id);
			return grant.returnTo;
		});

		if (isFailure(completed)) {
			return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });
		}

		return redirect(completed.data, { status: redirect.Status.SeeOther });
	}),
);

/**
 * `/auth/logout` controller: renders the sign-out confirmation on `GET` and, on `POST`,
 * ends the login at the provider with the `id_token_hint` the session holds before
 * dropping the session, falling back to `/` when the provider advertises no endpoint.
 *
 * @returns The sign-out page (`index`) or a logout redirect (`action`).
 */
export const logout = createController(routes.auth.logout, {
	actions: {
		async index(ctx) {
			return ctx.render(
				<Page title="Sign out">
					<h1>Sign out</h1>
					<form method="post" action={routes.auth.logout.action.href()}>
						<button mix={[s.button]} type="submit">
							Sign out
						</button>
					</form>
				</Page>,
			);
		},

		/**
		 * Reads the end-session URL before dropping the session, so the request carries
		 * the `id_token_hint` that ends the provider's session too.
		 */
		async action(ctx) {
			let endSession = await wrap(() =>
				relyingParty(ctx.url).endSession(ctx, {
					returnTo: routes.index.href(),
					redirect: false,
				}),
			);
			clearSession();

			if (isFailure(endSession)) {
				return redirect(routes.index.href(), { status: redirect.Status.SeeOther });
			}

			return redirect(endSession.data.toString(), { status: redirect.Status.SeeOther });
		},
	},
});
