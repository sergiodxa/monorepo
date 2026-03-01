import { ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import parseBasicAuth from "~/lib/parse-basic-auth";
import { reject } from "~/lib/reject";
import Client from "~/tenant/models/client";
import Secret from "~/tenant/models/client/secret";
import Session from "~/tenant/models/session";
import SigningKey from "~/tenant/models/signing-key";
import TenantMeta from "~/tenant/models/tenant-meta";
import AccessToken from "~/tenant/values/access-token";

let IntrospectSchema = s.object({
	token: s.string(),
	token_type_hint: s.optional(s.enum_(["access_token", "refresh_token"])),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});

export default action<"POST", "/oauth/introspect">(async ({ db, formData, request }) => {
	// Parse Basic auth if present
	let basicAuth = parseBasicAuth(request.headers.get("authorization"));
	let body = Object.fromEntries(formData) as Record<string, unknown>;

	// Merge Basic auth credentials into body
	if (basicAuth) {
		body.client_id = basicAuth.clientId;
		body.client_secret = basicAuth.clientSecret;
	}

	let result = await validate(body, IntrospectSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { token, token_type_hint, client_id, client_secret } = result.data;

	// Client authentication is required
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

	let headers = new Headers();
	headers.set("Cache-Control", "no-store");

	// Get issuer
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		return ok({ active: false }, { headers });
	}

	// Try refresh token (session) first if hinted or not specified
	if (token_type_hint !== "access_token") {
		let session = await Session.show(db, token);
		if (session && new Date(session.expiresAt) > new Date()) {
			return ok(
				{
					active: true,
					sub: session.subjectId,
					client_id: session.clientId,
					exp: Math.floor(new Date(session.expiresAt).getTime() / 1000),
					iat: Math.floor(new Date(session.createdAt).getTime() / 1000),
					iss: `https://${issuer}`,
					aud: session.clientId,
					token_type: "Bearer",
				},
				{ headers },
			);
		}
	}

	// Try access token
	try {
		let signingKeys = await SigningKey.getAll(db);
		if (signingKeys.length === 0) {
			return ok({ active: false }, { headers });
		}

		let accessToken = await AccessToken.verify(token, signingKeys, { issuer: `https://${issuer}` });

		return ok(
			{
				active: true,
				sub: accessToken.subject,
				client_id: accessToken.audience as string,
				exp: Math.floor(accessToken.expiresIn / 1000),
				iat: Math.floor(accessToken.issuedAt.getTime() / 1000),
				iss: accessToken.issuer,
				aud: accessToken.audience,
				token_type: "Bearer",
				scope: accessToken.scope,
			},
			{ headers },
		);
	} catch {
		// Token is invalid or expired
		return ok({ active: false }, { headers });
	}
});
