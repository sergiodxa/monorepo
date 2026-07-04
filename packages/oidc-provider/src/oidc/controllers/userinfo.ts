import { json } from "@pkg/http/response";

import TenantMeta from "../../management/models/tenant-meta";
import AccessToken from "../../oauth/values/access-token";
import action from "../../shared/lib/action";
import SigningKey from "../../signing-keys/models/signing-key";
import Subject from "../../subjects/models/subject";

/**
 * Returns an OAuth error response with WWW-Authenticate header per RFC 6750.
 * Bearer token errors must include the WWW-Authenticate header to inform
 * the client how to properly authenticate.
 */
function reject(error: string, description: string, status: number = 401) {
	return json(
		{ error, error_description: description },
		{
			status,
			headers: {
				"Cache-Control": "no-store",
				"WWW-Authenticate": `Bearer error="${error}", error_description="${description}"`,
			},
		},
	);
}

/**
 * OpenID Connect UserInfo endpoint (OIDC Core Section 5.3).
 * Returns claims about the authenticated end-user based on the access token scope.
 */
export default action<"GET", "/userinfo">(async ({ db, request, logger }) => {
	let log = logger.loader("/userinfo");

	let authHeader = request.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		log.info("Missing access token in Authorization header");
		return reject("invalid_request", "Missing access token");
	}

	let token = authHeader.slice(7);

	let [issuer, signingKeys] = await Promise.all([TenantMeta.getIssuer(db), SigningKey.getAll(db)]);

	if (!issuer) {
		log.error("Issuer not configured");
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.error("No signing keys available");
		return reject("server_error", "No signing keys available");
	}

	let accessToken;
	try {
		accessToken = await AccessToken.verify(token, signingKeys, { issuer: `https://${issuer}` });
	} catch {
		log.info("Access token verification failed");
		return reject("invalid_token", "Access token is invalid or expired");
	}

	log.info("Access token verified", { subjectId: accessToken.subject });

	let subject = await Subject.show(db, accessToken.subject);
	if (!subject) {
		log.info("Subject not found", { subjectId: accessToken.subject });
		return reject("invalid_token", "Subject not found");
	}

	let scope = accessToken.scope?.split(" ") ?? ["openid"];

	let userinfo: Record<string, unknown> = {
		sub: subject.id,
	};

	if (scope.includes("email")) {
		userinfo.email = subject.email;
		userinfo.email_verified = subject.email_verified_at !== null;
	}

	if (scope.includes("profile")) {
		userinfo.name = subject.display_name ?? subject.username;
		userinfo.preferred_username = subject.username;
		if (subject.avatar_url) {
			userinfo.picture = subject.avatar_url;
		}
	}

	log.info("Userinfo returned", { subjectId: subject.id, scopes: scope });

	return new Response(JSON.stringify(userinfo), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
});
