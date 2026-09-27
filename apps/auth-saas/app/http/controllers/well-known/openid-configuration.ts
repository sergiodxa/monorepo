/**
 * `GET /.well-known/openid-configuration` — the tenant's OpenID Connect discovery
 * document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { openIdConfiguration } from "@sdxc/well-known/openid-configuration";
import { respond } from "@sdxc/well-known/response";
import { createAction } from "remix/router";

import { openIdConfigurationFor } from "~/database/metadata";
import routes from "~/routes/tenant";

/**
 * Renders the tenant's OpenID configuration from facts read fresh from its Durable
 * Object on every request, cached for the lifetime the tenant publishes and answered
 * with a `304` for a client whose `ETag` still matches.
 *
 * @param ctx - The request context (provides `tenantStub`).
 * @example
 * router.map(routes.openidConfiguration, openidConfiguration);
 */
export default createAction(routes.openidConfiguration, async (ctx) => {
	let metadata = await ctx.tenantStub.publishMetadata({ now: Date.now() });

	return respond(openIdConfiguration, openIdConfigurationFor(metadata), {
		request: ctx.request,
		cache: { visibility: "public", maxAge: metadata.maxAge * 1000 },
	});
});
