/**
 * The token introspection endpoint (RFC 7662). Authenticates the calling
 * resource server, then reports whether a token is live and what it carries.
 * Any failure to resolve the token collapses to `{ active: false }`, because
 * telling a caller why a token failed would let it distinguish an expired token
 * from a forged one from one belonging to somebody else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok, unauthorized } from "@sdxc/http/response/json";
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

/**
 * POST /oauth/introspect — reports a token's validity and claims. RFC 7662 gives one
 * answer for a token this endpoint cannot resolve, so a fault in this server is reported
 * inactive like any other and named in the log at error level, where it stays visible.
 */
export default createAction(
	routes.oauth.introspect,
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

		let limited = await spendRateLimit(limiters.introspect, credentials.clientId);
		if (limited) return limited;

		let result = await validate(ctx.formData, TokenIntrospectionSchema);
		if (isFailure(result)) {
			ctx.log.set({ oidc: { error: "invalid_request" } });
			return badRequest({ error: "invalid_request", error_description: "Invalid request body" });
		}

		try {
			let introspection = await createOidcProvider(db).introspect({
				clientId: credentials.clientId,
				clientSecret: credentials.clientSecret,
				token: result.data.token,
				tokenTypeHint: result.data.token_type_hint,
			});

			ctx.log.set({ oidc: { token_active: introspection.active } });

			return ok(introspection);
		} catch (error) {
			if (error instanceof OIDC.Error && !(error instanceof OIDC.InternalServerError)) {
				ctx.log.set({ oidc: { error: error.code } });
			} else {
				ctx.log.fail(error);
			}

			return ok({ active: false });
		}
	}),
);
