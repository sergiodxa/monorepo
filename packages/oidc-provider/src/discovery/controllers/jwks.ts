/**
 * JSON Web Key Set (JWKS) endpoint (`/.well-known/jwks.json`).
 *
 * Publishes the tenant's public signing keys so clients and resource servers can
 * verify the JWTs this authorization server issues.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/http/response/json";
import { JWK } from "@pkg/jwt";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import routes from "../../routes";
import SigningKey from "../../signing-keys/models/signing-key";

/**
 * JSON Web Key Set (JWKS) endpoint (RFC 7517).
 * Provides the public keys used to verify JWTs issued by this authorization server.
 * @returns A JSON `Response` containing the public JWK set.
 */
export default createAction(
	routes.discover.jwks,
	inject([Database] as const, async (db) => {
		let { logger } = getContext();
		let log = logger.loader("/.well-known/jwks.json");

		let signingKeys = await SigningKey.getAll(db);

		if (signingKeys.length === 0) {
			log.info("JWKS served", { keyCount: 0 });
			return ok(
				{ keys: [] },
				{
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "public, max-age=3600",
					},
				},
			);
		}

		let jwks = JWK.toJSON(signingKeys);

		log.info("JWKS served", { keyCount: signingKeys.length });

		return ok(jwks, {
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600",
			},
		});
	}),
);
