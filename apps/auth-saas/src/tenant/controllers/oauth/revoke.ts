import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import parseBasicAuth from "~/lib/parse-basic-auth";
import { reject } from "~/lib/reject";
import Client from "~/tenant/models/client";
import Secret from "~/tenant/models/client/secret";
import Session from "~/tenant/models/session";

let RevokeSchema = s.object({
	token: s.string(),
	token_type_hint: s.optional(s.enum_(["access_token", "refresh_token"])),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});

export default action<"POST", "/oauth/revoke">(async ({ db, formData, request, logger }) => {
	let log = logger.action("/oauth/revoke");

	// Parse Basic auth if present
	let basicAuth = parseBasicAuth(request.headers.get("authorization"));
	let body = Object.fromEntries(formData) as Record<string, unknown>;

	// Merge Basic auth credentials into body
	if (basicAuth) {
		body.client_id = basicAuth.clientId;
		body.client_secret = basicAuth.clientSecret;
	}

	let result = await validate(body, RevokeSchema);
	if (isFailure(result)) {
		log.info("Validation failed", { reason: "invalid_request" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { token, token_type_hint, client_id, client_secret } = result.data;

	log.info("Token revocation started", {
		clientId: client_id,
		tokenTypeHint: token_type_hint ?? "none",
		authMethod: basicAuth ? "basic" : "body",
	});

	// Client authentication is required for confidential clients
	if (!client_id || !client_secret) {
		log.info("Client authentication missing");
		return reject("invalid_client", "Client authentication required", 401);
	}

	// Validate client
	let client = await Client.show(db, { id: client_id });
	if (!client) {
		log.info("Client not found", { clientId: client_id });
		return reject("invalid_client", "Client not found", 401);
	}

	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		log.info("Invalid client secret", { clientId: client.id });
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	// Access tokens are stateless JWTs - we can't truly revoke them
	// They will expire naturally. For refresh tokens (session IDs), we can revoke.
	if (token_type_hint === "access_token") {
		// Nothing to do for access tokens - they're stateless JWTs
		log.info("Access token revocation skipped (stateless JWT)", { clientId: client.id });
		return new Response(null, { status: 200 });
	}

	// Try to find and delete the session (refresh token)
	let session = await Session.show(db, token);
	if (session) {
		// Ensure the client owns this session
		if (session.client_id !== client.id) {
			// Per RFC 7009, we should still return 200 even if the token doesn't belong to the client
			// This prevents token enumeration attacks
			log.info("Session belongs to different client", {
				clientId: client.id,
				sessionClientId: session.client_id,
				sessionId: session.id,
			});
			return new Response(null, { status: 200 });
		}

		await Session.destroy(db, session.id);
		log.info("Session revoked", {
			clientId: client.id,
			sessionId: session.id,
			subjectId: session.subject_id,
		});
	} else {
		log.info("Session not found for revocation", { clientId: client.id });
	}

	// RFC 7009 requires returning 200 even if the token is invalid/not found
	return new Response(null, { status: 200 });
});
