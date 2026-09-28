/**
 * Builds the MCP router's fetch-router: the platform's own remote MCP server, exposing
 * the management API as tools to an agent holding a bearer token from the platform
 * tenant's own OIDC engine. Served on the bare platform domain, alongside — but kept
 * apart from — the platform's own public and dashboard pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import mcp from "~/app/http/controllers/mcp";
import notFound from "~/app/http/controllers/not-found";
import { mcpWellKnown } from "~/app/http/middleware/mcp-well-known";
import { MANAGEMENT_SECURITY_POLICY } from "~/app/http/security-policy";
import routes from "~/routes/mcp";

import { logger } from "./logger";

/** Kept as a non-tuple `Middleware[]` so the router context stays the base `RequestContext`. */
let globalMiddleware: Middleware[] = [
	log(logger) as Middleware,
	trace() as Middleware,
	asyncContext(),
	securityHeaders(MANAGEMENT_SECURITY_POLICY) as Middleware,
	mcpWellKnown(`https://${env.PLATFORM_DOMAIN}`),
];

/**
 * The MCP router, configured with the global middleware chain and a `404` default
 * handler. `bootstrap/worker.ts` dispatches `/mcp` and this server's own protected-
 * resource metadata path to it, leaving every other bare-platform-domain path to the
 * platform's own router.
 *
 * @example
 * return await mcpRouter.fetch(request);
 */
export const mcpRouter = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

mcpRouter.map(routes.mcp, mcp);
