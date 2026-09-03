/**
 * The UserInfo endpoint (OIDC Core §5.3). Verifies the bearer access token and returns
 * the claims the scopes it was issued with entitle the caller to — `sub` always,
 * email and profile claims only when their scope was granted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok, unauthorized } from "@sdxc/http/response/json";
import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { OIDC } from "~/app/auth/oidc-provider";
import { createOidcProvider } from "~/app/auth/repository";
import { ISSUER } from "~/app/config";
import routes from "~/routes/web";

/** The bearer realm every challenge names, so a client knows which server refused it. */
const REALM = `Bearer realm="${ISSUER}"`;

/**
 * The `401` this endpoint answers with, carrying the challenge RFC 6750 §3 requires.
 * The description stays the same for a missing, malformed, expired or forged token:
 * distinguishing them tells an attacker which of their guesses was closer.
 */
function invalidToken(description: string, challenge: string): Response {
	return unauthorized(
		{ error: "invalid_token", error_description: description },
		{ headers: { "WWW-Authenticate": challenge } },
	);
}

/**
 * GET /userinfo — returns the signed-in subject's claims for a bearer access token.
 * `sub` is unconditional per OIDC Core §5.4; every other claim is gated on the scope the
 * access token was issued with. A fault here answers the same challenge, named in the log.
 */
export default createAction(
	routes.userinfo,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let authorization = ctx.request.headers.get("Authorization");

		if (!authorization?.startsWith("Bearer ")) {
			ctx.logger.info("userinfo_missing_token");
			return invalidToken("Missing or invalid access token", REALM);
		}

		try {
			let { subject, scope } = await createOidcProvider(db).userinfo({
				accessToken: authorization.slice("Bearer ".length),
			});

			if (!subject) {
				ctx.logger.info("userinfo_subject_not_found");
				return invalidToken(
					"Subject not found",
					`${REALM}, error="invalid_token", error_description="Subject not found"`,
				);
			}

			ctx.logger.info("userinfo_success", { subjectId: subject.id });

			let claims: Record<string, unknown> = { sub: subject.id };

			if (scope.includes("email")) {
				claims.email = subject.emailAddress;
				claims.email_verified = subject.emailVerifiedAt !== null;
			}

			if (scope.includes("profile")) {
				claims.name = subject.displayName;
				claims.preferred_username = subject.username;
				claims.picture = subject.avatar;
			}

			return ok(claims);
		} catch (error) {
			if (error instanceof OIDC.InternalServerError) {
				ctx.logger.error("userinfo_server_error", { error: error.description });
			} else {
				ctx.logger.info("userinfo_invalid_token", {
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}

			return invalidToken(
				"Invalid or expired access token",
				`${REALM}, error="invalid_token", error_description="The access token is invalid or has expired"`,
			);
		}
	}),
);
