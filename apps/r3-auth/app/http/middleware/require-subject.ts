/**
 * Route guard for the signed-in area. Requires both tokens in the session, refreshes
 * the access token through the OIDC engine when it is close to expiring, resolves the
 * subject it names, and publishes it as `ctx.subject`. Any failure clears both tokens
 * and sends the visitor back to `/authorize` rather than leaving a half-valid session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { SelectSubject } from "~/database/schema";

import { createOidcProvider } from "~/app/auth/repository";
import Subject from "~/app/data/subject";
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

declare module "remix/fetch-router" {
	interface RequestContext {
		/** The signed-in subject, published by `requireSubject`. */
		subject: SelectSubject;
	}
}

/**
 * Requires a signed-in subject, refreshing the access token when needed.
 *
 * The refresh is silent, and both tokens are written back rather than only the access
 * token. The refresh token is the session row's id, so the grant hands back the *same*
 * value and only touches the row — but writing the pair is what keeps this correct if
 * the grant ever does issue a new id, since a session holding a stale refresh token
 * could never refresh again.
 */
export const requireSubject: Middleware = async (ctx, next) => {
	let accessToken = getAccessToken();
	let refreshToken = getRefreshToken();

	if (!accessToken || !refreshToken) {
		ctx.logger.info("auth_no_tokens");
		return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
	}

	let db = getServiceContainer().get(Database);

	if (isAccessTokenExpiringSoon(accessToken)) {
		try {
			ctx.logger.info("auth_refreshing_token");
			let tokens = await createOidcProvider(db).token({ type: "refresh_token", refreshToken });

			// The grant must answer with both tokens; anything else is a bug in the engine
			// and must sign the session out rather than half-write it.
			if (typeof tokens.access_token !== "string") throw new Error("No access token returned");
			if (!("refresh_token" in tokens)) throw new Error("No refresh token returned");
			if (typeof tokens.refresh_token !== "string") throw new Error("No refresh token returned");

			accessToken = tokens.access_token;
			setTokens(tokens.access_token, tokens.refresh_token);
			ctx.logger.info("auth_token_refreshed");
		} catch (error) {
			ctx.logger.error("auth_refresh_failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
			unsetTokens();
			return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
		}
	}

	let subjectId = getSubjectFromAccessToken(accessToken);
	let subject = subjectId ? await Subject.findById(db, subjectId) : null;

	if (!subject) {
		ctx.logger.info("auth_subject_not_found");
		unsetTokens();
		return redirect(routes.authorize.index.href(), { status: redirect.Status.SeeOther });
	}

	ctx.subject = subject;

	return next();
};

export default requireSubject;
