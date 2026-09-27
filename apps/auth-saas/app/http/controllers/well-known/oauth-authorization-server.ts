/**
 * `GET /.well-known/oauth-authorization-server` — the tenant's OAuth 2.0
 * authorization server metadata document (RFC 8414).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { authorizationServerMetadata } from "@sdxc/well-known/oauth-authorization-server";
import { respond } from "@sdxc/well-known/response";
import { createAction } from "remix/router";

import { authorizationServerMetadataFor } from "~/database/metadata";
import routes from "~/routes/tenant";

/**
 * Renders the tenant's OAuth authorization server metadata from facts read fresh from
 * its Durable Object on every request, cached for the lifetime the tenant publishes and
 * answered with a `304` for a client whose `ETag` still matches.
 *
 * @param ctx - The request context (provides `tenantStub`).
 * @example
 * router.map(routes.oauthAuthorizationServer, oauthAuthorizationServer);
 */
export default createAction(routes.oauthAuthorizationServer, async (ctx) => {
	let metadata = await ctx.tenantStub.publishMetadata({ now: Date.now() });

	return respond(authorizationServerMetadata, authorizationServerMetadataFor(metadata), {
		request: ctx.request,
		cache: { visibility: "public", maxAge: metadata.maxAge * 1000 },
	});
});
