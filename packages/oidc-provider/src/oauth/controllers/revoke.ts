/**
 * OAuth 2.0 Token Revocation endpoint controller (RFC 7009).
 *
 * Authenticates the calling client and revokes refresh tokens (sessions); access
 * tokens are stateless JWTs that remain valid until they expire naturally. The
 * endpoint always returns 200 regardless of token validity to prevent enumeration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Client from "../../clients/models/client";
import Secret from "../../clients/models/secret";
import routes from "../../routes";
import parseBasicAuth from "../../shared/lib/parse-basic-auth";
import { reject } from "../../shared/lib/reject";
import Session from "../models/session";

let RevokeSchema = s.object({
	token: s.string(),
	token_type_hint: s.optional(s.enum_(["access_token", "refresh_token"])),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});

/**
 * OAuth 2.0 Token Revocation endpoint (RFC 7009).
 * Always returns 200 regardless of validity, preventing token enumeration.
 * Revokes refresh tokens (sessions); access tokens expire naturally as JWTs.
 * @returns An empty `200` `Response` on success, or an OAuth error `Response` for bad client auth.
 */
export default createAction(
	routes.oauth.revoke,
	inject([Database] as const, async (db) => {
		let { formData, request, logger } = getContext();
		let log = logger.action("/oauth/revoke");

		let basicAuth = parseBasicAuth(request.headers.get("authorization"));
		let body = Object.fromEntries(formData) as Record<string, unknown>;

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

		if (!client_id || !client_secret) {
			log.info("Client authentication missing");
			return reject("invalid_client", "Client authentication required", 401);
		}

		let client = await Client.show(db, client_id);
		if (!client) {
			log.info("Client not found", { clientId: client_id });
			return reject("invalid_client", "Client not found", 401);
		}

		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			log.info("Invalid client secret", { clientId: client.id });
			return reject("invalid_client", "Invalid client credentials", 401);
		}

		if (token_type_hint === "access_token") {
			log.info("Access token revocation skipped (stateless JWT)", { clientId: client.id });
			return new Response(null, { status: 200 });
		}

		let session = await Session.show(db, token);
		if (session) {
			/**
			 * Per RFC 7009, return 200 even if the token belongs to a different client.
			 * This prevents token enumeration attacks.
			 */
			if (session.client_id !== client.id) {
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

		return new Response(null, { status: 200 });
	}),
);
