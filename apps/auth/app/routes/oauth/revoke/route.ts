/**
 * The OAuth 2.0 token revocation endpoint route (POST /oauth/revoke). Its action
 * authenticates the client via HTTP Basic credentials, rate-limits by client id, and
 * revokes refresh tokens through the OIDC service; access tokens are stateless JWTs
 * so they are a no-op. Per RFC 7009 it always returns 200 OK even for invalid or
 * unknown tokens to prevent token-probing attacks. Exists to let clients invalidate
 * tokens they no longer need.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, unauthorized } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { base64url } from "jose";
import { z } from "zod/v4";

import { logger } from "~/middleware/logger";
import { OIDCProvider } from "~/modules/oauth2";
import { rateLimit } from "~/modules/rate-limit";
import oidc from "~/services/oidc";

import type { Route } from "./+types/route";

const Schema = z.object({
	token: z.string(),
	token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
});

/**
 * OAuth 2.0 Token Revocation Endpoint (POST /oauth/revoke)
 *
 * Allows clients to notify the authorization server that a token is no longer
 * needed and should be invalidated. Per RFC 7009, the endpoint MUST return
 * 200 OK even for invalid or unknown tokens to prevent token probing attacks.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7009
 */
export async function action({ request }: Route.ActionArgs) {
	// Authenticate the client
	let clientCredentials = getClientCredentialsFromHeader(request.headers);

	if (!clientCredentials) {
		logger.info("revoke_missing_credentials");
		return unauthorized(
			{ error: "invalid_client", error_description: "Missing or invalid client credentials" },
			{ headers: { "WWW-Authenticate": "Basic" } },
		);
	}

	// Rate limit by client_id
	let limited = await rateLimit("REVOKE_RATE_LIMITER", clientCredentials.clientId);
	if (limited) return limited;

	let result = await validate(request, Schema);

	if (isFailure(result)) {
		logger.info("revoke_invalid_request");
		return badRequest({
			error: "invalid_request",
			error_description: "Invalid request body",
		});
	}

	let body = result.data;

	try {
		// Only refresh tokens can be revoked (access tokens are JWTs)
		// For access tokens, we return 200 OK per RFC 7009 (no-op)
		if (body.token_type_hint === "access_token") {
			logger.info("revoke_access_token_noop", { clientId: clientCredentials.clientId });
			// Access tokens are JWTs - cannot truly revoke, return 200 OK
			return new Response(null, { status: 200 });
		}

		await oidc.revoke({
			clientId: clientCredentials.clientId,
			clientSecret: clientCredentials.clientSecret,
			token: body.token,
			tokenTypeHint: body.token_type_hint ?? "refresh_token",
		});

		logger.info("revoke_success", { clientId: clientCredentials.clientId });
	} catch (error) {
		// Per RFC 7009, always return 200 OK even for invalid tokens
		// This prevents token probing attacks
		if (error instanceof OIDCProvider.Error) {
			logger.info("revoke_error", {
				clientId: clientCredentials.clientId,
				code: error.code,
				message: error.message,
			});
		} else {
			logger.error("revoke_unexpected_error", {
				clientId: clientCredentials.clientId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	// Always return 200 OK per RFC 7009
	return new Response(null, { status: 200 });
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
