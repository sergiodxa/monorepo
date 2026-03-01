import { JWK } from "@edgefirst-dev/jwt";
import { ok } from "@pkg/http/response/json";

import action from "~/lib/action";
import SigningKey from "~/tenant/models/signing-key";

export default action<"GET", "/.well-known/jwks.json">(async ({ db }) => {
	let signingKeys = await SigningKey.getAll(db);

	if (signingKeys.length === 0) {
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

	return ok(jwks, {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600", // Cache for 1 hour
		},
	});
});
