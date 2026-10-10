/**
 * Route guard for the signed-in area. Requires both tokens in the session, refreshes
 * the access token through the OIDC engine when it is close to expiring, resolves the
 * subject it names, and publishes it as `ctx.subject`. Any failure clears both tokens
 * and sends the visitor back to `/authorize`, closing out the session cleanly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { redirect } from "@sdxc/http/response";

import type { SelectSubject } from "~/database/schema";

import { createOidcProvider } from "~/app/auth/repository";
import { AUTH_SERVER_CLIENT_ID } from "~/app/config";
import {
	getAccessToken,
	getRefreshToken,
	setTokens,
	unsetTokens,
} from "~/app/http/middleware/session";
import {
	getSubjectFromAccessToken,
	isAccessTokenExpiringSoon,
} from "~/app/services/access-token-claims";
import routes from "~/routes/web";

declare module "remix/router" {
	interface RequestContext {
		/** The signed-in subject, published by `requireSubject`. */
		subject: SelectSubject;
	}
}

/**
 * Requires a signed-in subject, refreshing the access token as this server's own client,
 * the one its sign-in issued the session to. Both tokens are written back together, since
 * the refresh token is the session row's id and a stale one could never refresh again.
 */
export const requireSubject: Middleware = async (ctx, next) => {
	let accessToken = getAccessToken();
	let refreshToken = getRefreshToken();

	if (!accessToken || !refreshToken) {
		ctx.log.note("session.tokens_missing");
		return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
	}

	if (isAccessTokenExpiringSoon(accessToken)) {
		try {
			let client = await ctx.models.clients.find(AUTH_SERVER_CLIENT_ID);
			if (!client) throw new Error("Auth server client not found");

			let tokens = await createOidcProvider(ctx.models).token({
				type: "refresh_token",
				refreshToken,
				clientId: client.id,
				clientSecret: client.secret,
			});

			/**
			 * The grant must answer with both tokens; anything short of that signals an
			 * engine bug, so the guard signs the session out wholesale.
			 */
			if (typeof tokens.access_token !== "string") throw new Error("No access token returned");
			if (!("refresh_token" in tokens)) throw new Error("No refresh token returned");
			if (typeof tokens.refresh_token !== "string") throw new Error("No refresh token returned");

			accessToken = tokens.access_token;
			setTokens(tokens.access_token, tokens.refresh_token);
			ctx.log.note("session.token_refreshed");
		} catch (error) {
			ctx.log.warn("session.token_refresh_failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			unsetTokens();
			return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
		}
	}

	let subjectId = getSubjectFromAccessToken(accessToken);
	let subject = subjectId ? await ctx.models.subjects.find(subjectId) : null;

	if (!subject) {
		ctx.log.note("session.subject_not_found");
		unsetTokens();
		return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
	}

	ctx.subject = subject;
	ctx.log.set({ subject: { id: subject.id, role: subject.role } });

	return next();
};

export default requireSubject;
