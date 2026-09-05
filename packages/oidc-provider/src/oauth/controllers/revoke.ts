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

import Client from "../../clients/models/client.js";
import Secret from "../../clients/models/secret.js";
import routes from "../../routes.js";
import parseBasicAuth from "../../shared/lib/parse-basic-auth.js";
import { reject } from "../../shared/lib/reject.js";
import Session from "../models/session.js";

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
		let { formData, request, log } = getContext();

		let basicAuth = parseBasicAuth(request.headers.get("authorization"));
		let body = Object.fromEntries(formData) as Record<string, unknown>;

		if (basicAuth) {
			body.client_id = basicAuth.clientId;
			body.client_secret = basicAuth.clientSecret;
		}

		let result = await validate(body, RevokeSchema);
		if (isFailure(result)) {
			log.warn("http.invalid_params");
			return reject("invalid_request", "Missing or invalid parameters");
		}

		let { token, token_type_hint, client_id, client_secret } = result.data;

		log.set({
			client: { id: client_id },
			oidc: {
				token_type_hint: token_type_hint ?? "none",
				auth_method: basicAuth ? "basic" : "body",
			},
		});

		if (!client_id || !client_secret) {
			log.warn("client.auth_required");
			return reject("invalid_client", "Client authentication required", 401);
		}

		let client = await Client.show(db, client_id);
		if (!client) {
			log.warn("client.not_found");
			return reject("invalid_client", "Client not found", 401);
		}

		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			log.warn("client.invalid_credentials");
			return reject("invalid_client", "Invalid client credentials", 401);
		}

		if (token_type_hint === "access_token") {
			log.note("oidc.revoke.skipped", { reason: "stateless_access_token" });
			return new Response(null, { status: 200 });
		}

		let session = await Session.show(db, token);
		if (session) {
			/**
			 * Per RFC 7009, return 200 even if the token belongs to a different client.
			 * This prevents token enumeration attacks.
			 */
			if (session.client_id !== client.id) {
				log.warn("oidc.revoke.client_mismatch", {
					session_client_id: session.client_id,
					session_id: session.id,
				});
				return new Response(null, { status: 200 });
			}

			await Session.destroy(db, session.id);
			log.set({ subject: { id: session.subject_id } });
			log.note("oidc.revoke.session_revoked", { session_id: session.id });
		} else {
			log.note("oidc.revoke.session_not_found");
		}

		return new Response(null, { status: 200 });
	}),
);
