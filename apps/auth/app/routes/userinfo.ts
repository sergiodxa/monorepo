import { ok, unauthorized } from "@pkg/http/response/json";

import { logger } from "~/middleware/logger";
import oidc from "~/services/oidc";

import type { Route } from "./+types/userinfo";

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
		let subject = await oidc.userinfo({ accessToken });

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
		// Currently we support openid and email scopes
		return ok({
			sub: subject.id,
			name: subject.displayName,
			preferred_username: subject.username,
			picture: subject.avatar,
			email: subject.emailAddress,
			email_verified: subject.emailVerifiedAt !== null,
		});
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
