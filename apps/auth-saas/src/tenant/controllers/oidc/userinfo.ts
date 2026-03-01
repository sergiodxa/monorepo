import { json } from "@pkg/http/response";

import action from "~/lib/action";
import SigningKey from "~/tenant/models/signing-key";
import Subject from "~/tenant/models/subject";
import TenantMeta from "~/tenant/models/tenant-meta";
import AccessToken from "~/tenant/values/access-token";

// Bearer token errors require WWW-Authenticate header per RFC 6750
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

export default action<"GET", "/userinfo">(async ({ db, request }) => {
	// Extract Bearer token from Authorization header
	let authHeader = request.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return reject("invalid_request", "Missing access token");
	}

	let token = authHeader.slice(7);

	// Get issuer and signing keys
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		return reject("server_error", "Issuer not configured");
	}

	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) {
		return reject("server_error", "No signing keys available");
	}

	// Verify access token
	let accessToken;
	try {
		accessToken = await AccessToken.verify(token, signingKeys, { issuer: `https://${issuer}` });
	} catch {
		return reject("invalid_token", "Access token is invalid or expired");
	}

	// Get subject
	let subject = await Subject.show(db, { id: accessToken.subject });
	if (!subject) {
		return reject("invalid_token", "Subject not found");
	}

	// Parse scope
	let scope = accessToken.scope?.split(" ") ?? ["openid"];

	// Build userinfo response based on scope
	let userinfo: Record<string, unknown> = {
		sub: subject.id,
	};

	if (scope.includes("email")) {
		userinfo.email = subject.email;
		userinfo.email_verified = subject.emailVerifiedAt !== null;
	}

	if (scope.includes("profile")) {
		userinfo.name = subject.displayName ?? subject.username;
		userinfo.preferred_username = subject.username;
		if (subject.avatarUrl) {
			userinfo.picture = subject.avatarUrl;
		}
	}

	return new Response(JSON.stringify(userinfo), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
});
