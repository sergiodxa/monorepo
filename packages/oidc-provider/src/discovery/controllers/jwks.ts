/**
 * JSON Web Key Set (JWKS) endpoint (`/.well-known/jwks.json`).
 *
 * Publishes the tenant's public signing keys so clients and resource servers can
 * verify the JWTs this authorization server issues.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@sdxc/http/response/json";
import { JWK } from "@sdxc/jwt";
import { createAction } from "remix/router";

import routes from "../../routes.js";
import SigningKey from "../../signing-keys/models/signing-key.js";

/**
 * JSON Web Key Set (JWKS) endpoint (RFC 7517).
 * @returns A JSON `Response` containing the public JWK set.
 */
export default createAction(routes.discover.jwks, async (ctx) => {
	let { log } = ctx;

	let signingKeys = await SigningKey.getAll(ctx.db);

	if (signingKeys.length === 0) {
		log.note("oidc.discovery.jwks_served", { key_count: 0 });
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

	log.note("oidc.discovery.jwks_served", { key_count: signingKeys.length });

	return ok(jwks, {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
});
