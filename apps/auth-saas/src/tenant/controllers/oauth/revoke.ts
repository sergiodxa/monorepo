import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
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

export default action<"POST", "/oauth/revoke">(async ({ db, formData, request }) => {
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
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { token, token_type_hint, client_id, client_secret } = result.data;

	// Client authentication is required for confidential clients
	if (!client_id || !client_secret) {
		return reject("invalid_client", "Client authentication required", 401);
	}

	// Validate client
	let client = await Client.show(db, { id: client_id });
	if (!client) {
		return reject("invalid_client", "Client not found", 401);
	}

	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	// Access tokens are stateless JWTs - we can't truly revoke them
	// They will expire naturally. For refresh tokens (session IDs), we can revoke.
	if (token_type_hint === "access_token") {
		// Nothing to do for access tokens - they're stateless JWTs
		return new Response(null, { status: 200 });
	}

	// Try to find and delete the session (refresh token)
	let session = await Session.show(db, token);
	if (session) {
		// Ensure the client owns this session
		if (session.clientId !== client.id) {
			// Per RFC 7009, we should still return 200 even if the token doesn't belong to the client
			// This prevents token enumeration attacks
			return new Response(null, { status: 200 });
		}

		await Session.destroy(db, session.id);
	}

	// RFC 7009 requires returning 200 even if the token is invalid/not found
	return new Response(null, { status: 200 });
});

function parseBasicAuth(header: string | null): { clientId: string; clientSecret: string } | null {
	if (!header || !header.startsWith("Basic ")) return null;

	try {
		let encoded = header.slice(6);
		let decoded = atob(encoded);
		let [clientId, clientSecret] = decoded.split(":");
		if (!clientId || !clientSecret) return null;
		return {
			clientId: decodeURIComponent(clientId),
			clientSecret: decodeURIComponent(clientSecret),
		};
	} catch {
		return null;
	}
}
