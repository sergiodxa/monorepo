/**
 * The OAuth 2.0 token endpoint route (POST /oauth/token). Its action validates the
 * request into one of the supported grant types (authorization_code, refresh_token,
 * client_credentials), rate-limits by client id or IP, parses HTTP Basic client
 * credentials, and delegates to the OIDC service to mint tokens, returning RFC 6750
 * no-store headers and mapping provider errors to OAuth error responses. Exists as
 * the endpoint that exchanges grants for access, refresh and id tokens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, internalServerError, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { base64url } from "jose";
import { z } from "zod/v4";

import { logger } from "~/middleware/logger";
import { OIDCProvider } from "~/modules/oauth2";
import { checkRateLimit, rateLimitResponse } from "~/modules/rate-limit";
import oidc from "~/services/oidc";

import type { Route } from "./+types/route";

// RFC 6750 requires these headers on token responses
const TOKEN_RESPONSE_HEADERS = {
	"Cache-Control": "no-store",
	Pragma: "no-cache",
};

const AuthorizationCodeSchema = z.object({
	grant_type: z.literal("authorization_code"),
	code: z.string(),
	code_verifier: z.string().optional(),
	redirect_uri: z.url(),
});

const ClientCredentialsSchema = z.object({
	grant_type: z.literal("client_credentials"),
	resource: z
		.string()
		.or(z.string().array())
		.optional()
		.transform((v) => {
			if (Array.isArray(v)) return v;
			return v ? [v] : [];
		}),
});

const RefreshTokenSchema = z.object({
	grant_type: z.literal("refresh_token"),
	refresh_token: z.string(),
});

const Schema = z.discriminatedUnion("grant_type", [
	AuthorizationCodeSchema,
	ClientCredentialsSchema,
	RefreshTokenSchema,
]);

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(request, Schema);

	if (isFailure(result)) {
		logger.info("token_request_invalid");
		return badRequest({
			error: "invalid_request",
			error_description: "Invalid request body",
		});
	}

	let body = result.data;

	// Rate limit by client_id for client_credentials, or by IP for other grants
	let rateLimitKey: string;
	if (body.grant_type === "client_credentials") {
		let clientCredentials = getClientCredentialsFromHeader(request.headers);
		rateLimitKey =
			clientCredentials?.clientId ?? request.headers.get("cf-connecting-ip") ?? "unknown";
	} else {
		rateLimitKey = request.headers.get("cf-connecting-ip") ?? "unknown";
	}

	if (!(await checkRateLimit("TOKEN_RATE_LIMITER", rateLimitKey))) {
		return rateLimitResponse();
	}

	try {
		if (body.grant_type === "authorization_code") {
			// Get client credentials from Authorization header for confidential clients
			let clientCredentials = getClientCredentialsFromHeader(request.headers);

			let tokenResult = await oidc.token({
				type: "authorization_code",
				code: body.code,
				codeVerifier: body.code_verifier,
				redirectUri: body.redirect_uri,
				clientId: clientCredentials?.clientId,
				clientSecret: clientCredentials?.clientSecret,
			});
			logger.info("token_issued", { grant_type: "authorization_code" });
			return ok(tokenResult, { headers: TOKEN_RESPONSE_HEADERS });
		}

		if (body.grant_type === "refresh_token") {
			let tokenResult = await oidc.token({
				type: "refresh_token",
				refreshToken: body.refresh_token,
			});

			logger.info("token_issued", { grant_type: "refresh_token" });
			return ok(tokenResult, { headers: TOKEN_RESPONSE_HEADERS });
		}

		if (body.grant_type === "client_credentials") {
			let clientCredentials = getClientCredentialsFromHeader(request.headers);

			if (!clientCredentials) {
				logger.info("token_missing_credentials");
				return badRequest({
					error: "invalid_request",
					description: "Missing or invalid client credentials",
				});
			}

			let tokenResult = await oidc.token({
				type: "client_credentials",
				resource: body.resource ?? [],
				...clientCredentials,
			});

			logger.info("token_issued", {
				grant_type: "client_credentials",
				clientId: clientCredentials.clientId,
			});
			return ok(tokenResult, { headers: TOKEN_RESPONSE_HEADERS });
		}
	} catch (error) {
		if (error instanceof OIDCProvider.Error) {
			logger.info("token_oauth2_error", { code: error.code, message: error.message });
			return badRequest({ error: error.code, error_description: error.message });
		}

		if (error instanceof Error) {
			logger.error("token_exchange_error", { error: error.message });
			return internalServerError({
				error: "server_error",
				error_description: error.message,
			});
		}

		logger.error("token_exchange_error", { error: "Unknown error" });
		return internalServerError({
			error: "server_error",
			error_description: "An unexpected error occurred.",
		});
	}

	logger.info("token_unsupported_grant");
	return badRequest({
		error: "unsupported_grant_type",
		error_description: "The grant type is not supported.",
	});
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
