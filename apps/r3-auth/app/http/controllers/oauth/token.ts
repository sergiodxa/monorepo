/**
 * The token endpoint: exchanges an authorization code, a refresh token, or client
 * credentials for tokens. Authenticates the client from either HTTP Basic or the
 * request body, spends the token budget, and maps every engine failure to an OAuth
 * error envelope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getClientIP } from "@sdxc/get-client-ip";
import { badRequest, internalServerError, ok, unauthorized } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { OIDC } from "~/app/auth/oidc-provider";
import { createOidcProvider } from "~/app/auth/repository";
import { TokenRequestSchema } from "~/app/http/validators/oauth";
import { readClientCredentials } from "~/app/services/client-credentials";
import { spendRateLimit } from "~/app/services/rate-limit";
import RateLimiters from "~/app/services/rate-limiters";
import routes from "~/routes/web";

/**
 * Headers RFC 6749 §5.1 requires on every token response. Tokens must never be held
 * by a cache, and `Pragma` is there for the HTTP/1.0 intermediaries the RFC names.
 */
const NO_STORE_HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache" };

/**
 * The answer a fault in this server earns. RFC 6749 §5.2 reserves `400` for the six
 * codes it lists, every one of them the client's to fix, so a fault here carries the
 * `500` a client retries on and the `server_error` code of §4.1.2.1.
 */
function serverError(): Response {
	return internalServerError(
		{ error: "server_error", error_description: "An unexpected error occurred." },
		{ headers: NO_STORE_HEADERS },
	);
}

/**
 * Turns an engine failure into the OAuth error envelope its `error` code names: a protocol
 * error is the client's to fix and answers `400` with the code RFC 6749 §5.2 defines for it,
 * and a fault here answers the `500` a client retries on, keeping a still-good grant alive.
 */
function tokenError(error: unknown): Response {
	let ctx = getContext();

	if (error instanceof OIDC.InternalServerError) {
		ctx.logger.error("token_server_error", { error: error.description });
		return serverError();
	}

	if (error instanceof OIDC.Error) {
		ctx.logger.info("token_oauth2_error", { code: error.code });
		return badRequest(
			{ error: error.code, error_description: error.description },
			{ headers: NO_STORE_HEADERS },
		);
	}

	ctx.logger.error("token_exchange_error", {
		error: error instanceof Error ? error.message : "Unknown error",
	});

	return serverError();
}

/**
 * POST /oauth/token — runs one of the three supported grants. Client-credentials
 * callers are server-to-server, so their budget is spent per client; browser-driven
 * grants are budgeted per address, all an unauthenticated code exchange offers.
 */
export default createAction(
	routes.oauth.token,
	inject([Database, RateLimiters] as const, async (db, limiters) => {
		let ctx = getContext();

		let result = await validate(ctx.formData, TokenRequestSchema);
		if (isFailure(result)) {
			ctx.logger.info("token_request_invalid");
			return badRequest(
				{ error: "invalid_request", error_description: "Invalid request body" },
				{ headers: NO_STORE_HEADERS },
			);
		}

		let body = result.data;
		let credentials = readClientCredentials(ctx.request.headers, body);

		let limited = await spendRateLimit(
			limiters.token,
			body.grant_type === "client_credentials" && credentials
				? credentials.clientId
				: (getClientIP(ctx.request) ?? "unknown"),
		);
		if (limited) return limited;

		let oidc = createOidcProvider(db);

		try {
			if (body.grant_type === "authorization_code") {
				let tokens = await oidc.token({
					type: "authorization_code",
					code: body.code,
					codeVerifier: body.code_verifier,
					redirectUri: body.redirect_uri,
					clientId: credentials?.clientId,
					clientSecret: credentials?.clientSecret,
				});

				ctx.logger.info("token_issued", { grantType: "authorization_code" });
				return ok(tokens, { headers: NO_STORE_HEADERS });
			}

			if (body.grant_type === "refresh_token") {
				let tokens = await oidc.token({
					type: "refresh_token",
					refreshToken: body.refresh_token,
				});

				ctx.logger.info("token_issued", { grantType: "refresh_token" });
				return ok(tokens, { headers: NO_STORE_HEADERS });
			}

			if (!credentials) {
				ctx.logger.info("token_missing_credentials");
				return unauthorized(
					{
						error: "invalid_client",
						error_description: "Missing or invalid client credentials",
					},
					{ headers: { ...NO_STORE_HEADERS, "WWW-Authenticate": "Basic" } },
				);
			}

			let tokens = await oidc.token({
				type: "client_credentials",
				resource: body.resource,
				...credentials,
			});

			ctx.logger.info("token_issued", {
				grantType: "client_credentials",
				clientId: credentials.clientId,
			});
			return ok(tokens, { headers: NO_STORE_HEADERS });
		} catch (error) {
			return tokenError(error);
		}
	}),
);
