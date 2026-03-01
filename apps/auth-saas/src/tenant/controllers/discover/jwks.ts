import { JWK } from "@edgefirst-dev/jwt";
import { ok } from "@pkg/http/response/json";

import action from "~/lib/action";
import SigningKey from "~/tenant/models/signing-key";

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
					"Cache-Control": "public, max-age=3600", // Cache for 1 hour
				},
			},
		);
	}

	// Convert to JWK Set format
	let jwks = JWK.toJSON(signingKeys);

	log.info("JWKS served", { keyCount: signingKeys.length });

	return ok(jwks, {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600", // Cache for 1 hour
		},
	});
});
