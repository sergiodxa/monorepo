/**
 * The token revocation endpoint (RFC 7009). Authenticates the client, then deletes the
 * session a refresh token names. Access tokens are self-contained JWTs and cannot be
 * withdrawn, so a hint naming one is accepted and does nothing.
 *
 * Always answers `200`, even for a token that does not exist or is not the caller's:
 * anything else turns the endpoint into an oracle for which tokens are live.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, unauthorized } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
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
			ctx.logger.info("revoke_missing_credentials");
			return unauthorized(
				{ error: "invalid_client", error_description: "Missing or invalid client credentials" },
				{ headers: { "WWW-Authenticate": "Basic" } },
			);
		}

		let limited = await spendRateLimit(limiters.revoke, credentials.clientId);
		if (limited) return limited;

		let result = await validate(ctx.formData, TokenIntrospectionSchema);
		if (isFailure(result)) {
			ctx.logger.info("revoke_invalid_request");
			return badRequest({ error: "invalid_request", error_description: "Invalid request body" });
		}

		let body = result.data;

		if (body.token_type_hint === "access_token") {
			ctx.logger.info("revoke_access_token_noop", { clientId: credentials.clientId });
			return new Response(null, { status: 200 });
		}

		try {
			await createOidcProvider(db).revoke({
				clientId: credentials.clientId,
				clientSecret: credentials.clientSecret,
				token: body.token,
				tokenTypeHint: body.token_type_hint ?? "refresh_token",
			});

			ctx.logger.info("revoke_success", { clientId: credentials.clientId });
		} catch (error) {
			if (error instanceof OIDC.Error) {
				ctx.logger.info("revoke_error", { clientId: credentials.clientId, code: error.code });
			} else {
				ctx.logger.error("revoke_unexpected_error", {
					clientId: credentials.clientId,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		return new Response(null, { status: 200 });
	}),
);
