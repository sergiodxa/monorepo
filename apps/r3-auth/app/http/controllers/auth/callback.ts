/**
 * This server's own OAuth callback: the account area is reached through the same
 * authorization flow relying parties use, so this endpoint redeems that code and
 * stores the tokens in the browser session. It is the one place this server acts as a
 * client of itself, so the `state` and the client id are checked against the parked
 * request first — a code for any other client belongs to somebody else's session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/json";
import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { createOidcProvider } from "~/app/auth/repository";
import { AUTH_SERVER_CLIENT_ID } from "~/app/config";
import Client from "~/app/data/client";
import { getAuthz, setTokens, unsetAuthz } from "~/app/http/middleware/session";
import routes from "~/routes/web";

/**
 * GET /auth/callback — redeems this server's own authorization code and starts a
 * session. The exchange authenticates with the client secret, the session begins only
 * once a refresh token comes back, and a failure logs the OAuth reason alone.
 */
export default createAction(
	routes.auth.callback,
	inject([Database] as const, async (db) => {
		let ctx = getContext();

		let code = ctx.url.searchParams.get("code");
		let state = ctx.url.searchParams.get("state");

		if (!code || !state) {
			ctx.log.note("auth.callback.params_missing");
			return badRequest({ message: "Missing code or state parameter" });
		}

		let authz = getAuthz();
		if (!authz) {
			ctx.log.note("auth.callback.authz_missing");
			return badRequest({ message: "Invalid request - no authorization session" });
		}

		if (authz.state !== state) {
			ctx.log.note("auth.callback.state_mismatch");
			return badRequest({ message: "Invalid state parameter" });
		}

		if (authz.clientId !== AUTH_SERVER_CLIENT_ID) {
			ctx.log.note("auth.callback.wrong_client", { client_id: authz.clientId });
			return badRequest({ message: "Invalid client" });
		}

		let client = await Client.findById(db, AUTH_SERVER_CLIENT_ID);
		if (!client) {
			ctx.log.warn("auth.callback.client_missing");
			return badRequest({ message: "Auth server client not found" });
		}

		try {
			let tokens = await createOidcProvider(db).token({
				type: "authorization_code",
				code,
				redirectUri: authz.redirectUri,
				clientId: client.id,
				clientSecret: client.secret,
			});

			if (!("refresh_token" in tokens) || typeof tokens.refresh_token !== "string") {
				ctx.log.warn("auth.callback.refresh_token_missing");
				return badRequest({ message: "Failed to exchange authorization code" });
			}

			unsetAuthz();
			setTokens(tokens.access_token, tokens.refresh_token);

			ctx.log.note("auth.callback.completed");

			return redirect(routes.account.sessions.index.href(), {
				status: redirect.Status.SeeOther,
			});
		} catch (error) {
			ctx.log.warn("auth.callback.token_exchange_failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return badRequest({ message: "Failed to exchange authorization code" });
		}
	}),
);
