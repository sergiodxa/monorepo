/**
 * Builds the tenant router's fetch-router: the pure-JSON protocol endpoints a
 * request already resolved to one tenant reaches — discovery, JWKS, `/userinfo`,
 * and the token endpoint. `/authorize`'s hosted sign-in and consent pages live
 * behind the not-yet-built hosted UI and are not mapped here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import notFound from "~/app/http/controllers/not-found";
import token from "~/app/http/controllers/oauth/token";
import { userinfoGet, userinfoPost } from "~/app/http/controllers/userinfo";
import jwks from "~/app/http/controllers/well-known/jwks";
import oauthAuthorizationServer from "~/app/http/controllers/well-known/oauth-authorization-server";
import openidConfiguration from "~/app/http/controllers/well-known/openid-configuration";
import { tenant } from "~/app/http/middleware/tenant";
import routes from "~/routes/tenant";

import { logger } from "./logger";

/** Kept as a non-tuple `Middleware[]` so the router context stays the base `RequestContext`. */
let globalMiddleware: Middleware[] = [
	log(logger) as Middleware,
	asyncContext(),
	tenant((tenantId) => env.TENANT.getByName(tenantId)),
];

/**
 * The tenant router, configured with the global middleware chain and a `404`
 * default handler. `bootstrap/worker.ts`'s `forwardToTenant` calls
 * `tenantRouter.fetch(request)` once it has stamped the resolved tenant's facts
 * onto the request's internal headers.
 *
 * @example
 * return await tenantRouter.fetch(request);
 */
export const tenantRouter = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

tenantRouter.map(routes.openidConfiguration, openidConfiguration);
tenantRouter.map(routes.oauthAuthorizationServer, oauthAuthorizationServer);
tenantRouter.map(routes.jwks, jwks);
tenantRouter.map(routes.userinfoGet, userinfoGet);
tenantRouter.map(routes.userinfoPost, userinfoPost);
tenantRouter.map(routes.token, token);
