/**
 * OAuth 2.0 Token Introspection endpoint controller (RFC 7662).
 *
 * Authenticates the calling client, then reports whether a presented token is
 * active and returns its metadata — checking refresh tokens (sessions) and
 * verifying access-token JWTs against the tenant's signing keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@sdxc/http/response/json";
import { JWK } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Client from "../../clients/models/client.js";
import Secret from "../../clients/models/secret.js";
import TenantMeta from "../../management/models/tenant-meta.js";
import routes from "../../routes.js";
import parseBasicAuth from "../../shared/lib/parse-basic-auth.js";
import { reject } from "../../shared/lib/reject.js";
import SigningKey from "../../signing-keys/models/signing-key.js";
import Session from "../models/session.js";
import AccessToken from "../values/access-token.js";

let IntrospectSchema = s.object({
	token: s.string(),
	token_type_hint: s.optional(s.enum_(["access_token", "refresh_token"])),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});

/**
 * OAuth 2.0 Token Introspection endpoint (RFC 7662).
 * Allows resource servers to query the authorization server about the active state of a token.
 * Returns token metadata including subject, client, expiration, and scope.
 * @returns A JSON `Response` with `{ active: boolean, ... }`, or an OAuth error `Response`.
 */
export default createAction(
	routes.oauth.introspect,
	inject([Database] as const, async (db) => {
		let { formData, request, logger } = getContext();
		let log = logger.action("/oauth/introspect");

		let basicAuth = parseBasicAuth(request.headers.get("authorization"));
		let body = Object.fromEntries(formData) as Record<string, unknown>;

		if (basicAuth) {
			body.client_id = basicAuth.clientId;
			body.client_secret = basicAuth.clientSecret;
		}

		let result = await validate(body, IntrospectSchema);
		if (isFailure(result)) {
			log.info("Invalid request parameters");
			return reject("invalid_request", "Missing or invalid parameters");
		}

		let { token, token_type_hint, client_id, client_secret } = result.data;

		log.info("Token introspection request", {
			clientId: client_id,
			tokenTypeHint: token_type_hint,
		});

		if (!client_id || !client_secret) {
			log.info("Client authentication missing");
			return reject("invalid_client", "Client authentication required", 401);
		}

		let [client, issuer] = await Promise.all([
			Client.show(db, client_id),
			TenantMeta.getIssuer(db),
		]);

		if (!client) {
			log.info("Client not found", { clientId: client_id });
			return reject("invalid_client", "Client not found", 401);
		}

		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			log.info("Invalid client credentials", { clientId: client_id });
			return reject("invalid_client", "Invalid client credentials", 401);
		}

		let headers = new Headers();
		headers.set("Cache-Control", "no-store");

		if (!issuer) {
			log.info("Issuer not configured, token inactive", { clientId: client_id });
			return ok({ active: false }, { headers });
		}

		if (token_type_hint !== "access_token") {
			let session = await Session.show(db, token);
			if (session && new Date(session.expires_at) > new Date()) {
				log.info("Refresh token introspected successfully", {
					clientId: client_id,
					sessionId: session.id,
					subjectId: session.subject_id,
				});
				return ok(
					{
						active: true,
						sub: session.subject_id,
						client_id: session.client_id,
						exp: Math.floor(new Date(session.expires_at).getTime() / 1000),
						iat: Math.floor(new Date(session.created_at).getTime() / 1000),
						iss: `https://${issuer}`,
						aud: session.client_id,
						token_type: "Bearer",
					},
					{ headers },
				);
			}
		}

		try {
			let signingKeys = await SigningKey.getAll(db);
			if (signingKeys.length === 0) {
				log.info("No signing keys configured, token inactive", { clientId: client_id });
				return ok({ active: false }, { headers });
			}

			let accessToken = await AccessToken.verify(token, signingKeys, {
				issuer: `https://${issuer}`,
				algorithms: [JWK.Algorithm.ES256],
			});

			// Reading these two off the payload keeps a token that carries no scope, or one
			// minted before the client_id claim existed, active for its remaining lifetime:
			// an absent claim is omitted from the response instead of throwing below.
			let { client_id: tokenClientId, scope } = accessToken.payload;

			log.info("Access token introspected successfully", {
				clientId: client_id,
				subjectId: accessToken.subject,
				scope,
			});

			return ok(
				{
					active: true,
					sub: accessToken.subject,
					client_id: tokenClientId,
					exp: accessToken.expirationTime,
					iat: Math.floor(accessToken.issuedAt.getTime() / 1000),
					iss: accessToken.issuer,
					aud: accessToken.audience,
					token_type: "Bearer",
					scope,
				},
				{ headers },
			);
		} catch {
			log.info("Token invalid or expired", { clientId: client_id });
			return ok({ active: false }, { headers });
		}
	}),
);
