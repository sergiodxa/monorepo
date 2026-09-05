/**
 * The token revocation endpoint (RFC 7009). Authenticates the client, then deletes the
 * session a refresh token names. Access tokens are self-contained JWTs that expire on
 * their own, so a hint naming one succeeds with storage untouched.
 *
 * Always answers `200`, whatever the token was: any other status turns the endpoint
 * into an oracle for which tokens are live.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, unauthorized } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { OIDC } from "~/app/auth/oidc-provider";
import { createOidcProvider } from "~/app/auth/repository";
import { TokenIntrospectionSchema } from "~/app/http/validators/oauth";
import { credentialsFromHeader } from "~/app/services/client-credentials";
import { spendRateLimit } from "~/app/services/rate-limit";
import RateLimiters from "~/app/services/rate-limiters";
import routes from "~/routes/web";

/** POST /oauth/revoke — invalidates a refresh token the calling client owns. */
export default createAction(
	routes.oauth.revoke,
	inject([Database, RateLimiters] as const, async (db, limiters) => {
		let ctx = getContext();

		let credentials = credentialsFromHeader(ctx.request.headers);
		if (!credentials) {
			ctx.log.set({ oidc: { error: "invalid_client" } });
			return unauthorized(
				{ error: "invalid_client", error_description: "Missing or invalid client credentials" },
				{ headers: { "WWW-Authenticate": "Basic" } },
			);
		}

		ctx.log.set({ client: { id: credentials.clientId } });

		let limited = await spendRateLimit(limiters.revoke, credentials.clientId);
		if (limited) return limited;

		let result = await validate(ctx.formData, TokenIntrospectionSchema);
		if (isFailure(result)) {
			ctx.log.set({ oidc: { error: "invalid_request" } });
			return badRequest({ error: "invalid_request", error_description: "Invalid request body" });
		}

		let body = result.data;

		if (body.token_type_hint === "access_token") {
			ctx.log.note("oidc.revoke.access_token_noop");
			return new Response(null, { status: 200 });
		}

		try {
			await createOidcProvider(db).revoke({
				clientId: credentials.clientId,
				clientSecret: credentials.clientSecret,
				token: body.token,
				tokenTypeHint: body.token_type_hint ?? "refresh_token",
			});

			ctx.log.note("oidc.revoke.revoked");
		} catch (error) {
			if (error instanceof OIDC.Error) {
				ctx.log.set({ oidc: { error: error.code } });
			} else {
				ctx.log.fail(error);
			}
		}

		return new Response(null, { status: 200 });
	}),
);
