import { JWK } from "@edgefirst-dev/jwt";
import { ok } from "@pkg/http/response/json";

import action from "../../lib/action";
import SigningKey from "../../models/signing-key";

/**
 * JSON Web Key Set (JWKS) endpoint (RFC 7517).
 * Provides the public keys used to verify JWTs issued by this authorization server.
 */
export default action<"GET", "/.well-known/jwks.json">(async ({ db, logger }) => {
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
});
