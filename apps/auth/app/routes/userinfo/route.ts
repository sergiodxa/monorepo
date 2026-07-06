/**
 * The OIDC UserInfo endpoint route (GET /userinfo). Its loader reads the Bearer
 * access token, resolves the subject and granted scopes via the OIDC service, and
 * returns the standard claims (always sub, plus email and profile claims gated by
 * scope), responding 401 with WWW-Authenticate headers on missing or invalid tokens.
 * Exists to expose authenticated user claims per OIDC Core 1.0 Section 5.3.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok, unauthorized } from "@pkg/http/response/json";

import { logger } from "~/middleware/logger";
import oidc from "~/services/oidc";

import type { Route } from "./+types/route";

/**
 * OIDC UserInfo Endpoint (GET /userinfo)
 *
 * Returns claims about the authenticated user based on the access token.
 * Per OIDC Core 1.0, the response includes the `sub` claim and any claims
 * associated with the granted scopes.
 *
 * @see https://openid.net/specs/openid-connect-core-1_0.html#UserInfo
 */
export async function loader({ request }: Route.LoaderArgs) {
	let authHeader = request.headers.get("Authorization");

	if (!authHeader?.startsWith("Bearer ")) {
		logger.info("userinfo_missing_token");
		return unauthorized(
			{ error: "invalid_token", error_description: "Missing or invalid access token" },
			{ headers: { "WWW-Authenticate": 'Bearer realm="auth.sergiodxa.com"' } },
		);
	}

	let accessToken = authHeader.slice(7);

	try {
		let { subject, scope } = await oidc.userinfo({ accessToken });

		if (!subject) {
			logger.info("userinfo_subject_not_found");
			return unauthorized(
				{ error: "invalid_token", error_description: "Subject not found" },
				{
					headers: {
						"WWW-Authenticate":
							'Bearer realm="auth.sergiodxa.com", error="invalid_token", error_description="Subject not found"',
					},
				},
			);
		}

		logger.info("userinfo_success", { subjectId: subject.id });

		// Return OIDC standard claims based on granted scopes
		// Per OIDC Core 1.0 Section 5.4
		let response: Record<string, unknown> = {
			sub: subject.id, // Always included per OIDC
		};

		// email scope: email, email_verified
		if (scope.includes("email")) {
			response.email = subject.emailAddress;
			response.email_verified = subject.emailVerifiedAt !== null;
		}

		// profile scope: name, preferred_username, picture
		if (scope.includes("profile")) {
			response.name = subject.displayName;
			response.preferred_username = subject.username;
			response.picture = subject.avatar;
		}

		return ok(response);
	} catch (error) {
		logger.info("userinfo_invalid_token", {
			error: error instanceof Error ? error.message : "Unknown error",
		});

		return unauthorized(
			{ error: "invalid_token", error_description: "Invalid or expired access token" },
			{
				headers: {
					"WWW-Authenticate":
						'Bearer realm="auth.sergiodxa.com", error="invalid_token", error_description="The access token is invalid or has expired"',
				},
			},
		);
	}
}
