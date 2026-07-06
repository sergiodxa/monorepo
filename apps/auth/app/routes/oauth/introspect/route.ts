/**
 * The OAuth 2.0 token introspection endpoint route (POST /oauth/introspect). Its
 * action authenticates the calling resource server via HTTP Basic credentials,
 * rate-limits by client id, validates the token payload, and returns the token's
 * metadata and validity per RFC 7662 — collapsing any error to { active: false } so
 * invalid tokens reveal nothing. Exists so resource servers can verify tokens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok, unauthorized } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { base64url } from "jose";
import { z } from "zod/v4";

import { logger } from "~/middleware/logger";
import { OIDCProvider } from "~/modules/oauth2";
import { checkRateLimit, rateLimitResponse } from "~/modules/rate-limit";
import oidc from "~/services/oidc";

import type { Route } from "./+types/route";

const Schema = z.object({
	token: z.string(),
	token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
});

/**
 * OAuth 2.0 Token Introspection Endpoint (POST /oauth/introspect)
 *
 * Allows resource servers to query token metadata and validity.
 * Per RFC 7662, returns { active: true, ...claims } for valid tokens
 * and { active: false } for invalid/expired tokens.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7662
 */
export async function action({ request }: Route.ActionArgs) {
	// Authenticate the requesting client/resource server
	let clientCredentials = getClientCredentialsFromHeader(request.headers);

	if (!clientCredentials) {
		logger.info("introspect_missing_credentials");
		return unauthorized(
			{ error: "invalid_client", error_description: "Missing or invalid client credentials" },
			{ headers: { "WWW-Authenticate": "Basic" } },
		);
	}

	// Rate limit by client_id
	if (!(await checkRateLimit("INTROSPECT_RATE_LIMITER", clientCredentials.clientId))) {
		return rateLimitResponse();
	}

	let result = await validate(request, Schema);

	if (isFailure(result)) {
		logger.info("introspect_invalid_request");
		return badRequest({
			error: "invalid_request",
			error_description: "Invalid request body",
		});
	}

	let body = result.data;

	try {
		let introspection = await oidc.introspect({
			clientId: clientCredentials.clientId,
			clientSecret: clientCredentials.clientSecret,
			token: body.token,
			tokenTypeHint: body.token_type_hint,
		});

		logger.info("introspect_success", {
			clientId: clientCredentials.clientId,
			active: introspection.active,
		});

		return ok(introspection);
	} catch (error) {
		// Per RFC 7662, return { active: false } for invalid tokens
		// Never reveal why the token is invalid
		if (error instanceof OIDCProvider.Error) {
			logger.info("introspect_error", {
				clientId: clientCredentials.clientId,
				code: error.code,
			});
		} else {
			logger.error("introspect_unexpected_error", {
				clientId: clientCredentials.clientId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}

		return ok({ active: false });
	}
}

function getClientCredentialsFromHeader(headers: Headers) {
	let authorization = headers.get("Authorization");
	if (!authorization) return null;

	let [type, token] = authorization.split(" ");
	if (type !== "Basic") return null;

	if (!token) return null;

	let [clientId, clientSecret] = new TextDecoder().decode(base64url.decode(token)).split(":");

	if (!clientId || !clientSecret) return null;

	return { clientId, clientSecret };
}
