/**
 * This server's own OAuth callback. The account area is reached by signing in through
 * the same authorization flow relying parties use, so this endpoint redeems the code
 * that flow issued and stores the resulting tokens in the browser session.
 *
 * It is the one place where this server acts as a client of itself, which is why the
 * `state` and the client id are checked against the parked request before the exchange:
 * a code arriving here for any other client is not a session this server may adopt.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { badRequest } from "@pkg/http/response/json";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { createOidcProvider } from "~/app/auth/repository";
import { AUTH_SERVER_CLIENT_ID } from "~/app/config";
import Client from "~/app/data/client";
import { getAuthz, setTokens, unsetAuthz } from "~/app/http/middleware/session";
import routes from "~/routes/web";

/** GET /auth/callback — redeems this server's own authorization code and starts a session. */
export default createAction(
	routes.auth.callback,
	inject([Database] as const, async (db) => {
		let ctx = getContext();

		let code = ctx.url.searchParams.get("code");
		let state = ctx.url.searchParams.get("state");

		if (!code || !state) {
			ctx.logger.info("auth_callback_missing_params");
			return badRequest({ message: "Missing code or state parameter" });
		}

		let authz = getAuthz();
		if (!authz) {
			ctx.logger.info("auth_callback_missing_authz");
			return badRequest({ message: "Invalid request - no authorization session" });
		}

		if (authz.state !== state) {
			ctx.logger.info("auth_callback_state_mismatch");
			return badRequest({ message: "Invalid state parameter" });
		}

		if (authz.clientId !== AUTH_SERVER_CLIENT_ID) {
			ctx.logger.info("auth_callback_wrong_client", { clientId: authz.clientId });
			return badRequest({ message: "Invalid client" });
		}

		let client = await Client.findById(db, AUTH_SERVER_CLIENT_ID);
		if (!client) {
			ctx.logger.error("auth_callback_client_not_found");
			return badRequest({ message: "Auth server client not found" });
		}

		try {
			// Authenticated as its own client, like any other relying party: the
			// registration carries a secret and the grant refuses an unauthenticated
			// exchange, so skipping it here would make this the one privileged path.
			let tokens = await createOidcProvider(db).token({
				type: "authorization_code",
				code,
				redirectUri: authz.redirectUri,
				clientId: client.id,
				clientSecret: client.secret,
			});

			// Narrowed rather than asserted: `token()` answers three grants and only two
			// of them mint a refresh token, and this session is unusable without one.
			if (!("refresh_token" in tokens) || typeof tokens.refresh_token !== "string") {
				ctx.logger.error("auth_callback_missing_refresh_token");
				return badRequest({ message: "Failed to exchange authorization code" });
			}

			unsetAuthz();
			setTokens(tokens.access_token, tokens.refresh_token);

			ctx.logger.info("auth_callback_success");

			return redirect(routes.account.sessions.index.href(), {
				status: redirect.Status.SeeOther,
			});
		} catch (error) {
			// The message is the engine's own OAuth reason, never the code or the tokens.
			ctx.logger.error("auth_callback_token_exchange_failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			return badRequest({ message: "Failed to exchange authorization code" });
		}
	}),
);
