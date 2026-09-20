/**
 * `GET /.well-known/jwks.json` — the tenant's published JSON Web Key Set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { etag } from "@sdxc/http/cache";
import { ok } from "@sdxc/http/response/json";
import { isSuccess } from "@sdxc/result";
import { createAction } from "remix/router";

import routes from "~/routes/tenant";

/**
 * Renders the tenant's currently published key set, assembled fresh from its
 * Durable Object on every request: the caching layer this document deserves is
 * not built yet, so a cold cache here costs one round trip rather than none.
 *
 * @param ctx - The request context (provides `tenantStub`).
 * @returns The JWKS document as JSON, with the caching headers the tenant
 * published alongside it.
 * @example
 * router.map(routes.jwks, jwks);
 */
export default createAction(routes.jwks, async (ctx) => {
	let metadata = await ctx.tenantStub.publishMetadata({ now: Date.now() });
	let tag = await etag(metadata.version);

	let headers: Record<string, string> = {
		"Cache-Control": `public, max-age=${metadata.maxAge}`,
	};
	if (isSuccess(tag)) headers.ETag = tag.data;

	return ok(metadata.jwks, { headers });
});
