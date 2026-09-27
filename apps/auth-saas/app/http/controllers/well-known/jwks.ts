/**
 * `GET /.well-known/jwks.json` — the tenant's published JSON Web Key Set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { jwks as jwkSet } from "@sdxc/well-known/jwks";
import { respond } from "@sdxc/well-known/response";
import { createAction } from "remix/router";

import routes from "~/routes/tenant";

/**
 * Renders the tenant's currently published key set, read fresh from its Durable Object
 * on every request, cached for the lifetime the tenant publishes. The descriptor writes
 * each key's public half only, so the response carries no private material.
 *
 * @param ctx - The request context (provides `tenantStub`).
 * @example
 * router.map(routes.jwks, jwks);
 */
export default createAction(routes.jwks, async (ctx) => {
	let metadata = await ctx.tenantStub.publishMetadata({ now: Date.now() });

	return respond(jwkSet, metadata.jwks, {
		request: ctx.request,
		cache: { visibility: "public", maxAge: metadata.maxAge * 1000 },
	});
});
