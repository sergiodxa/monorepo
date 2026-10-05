/**
 * Builds the MCP router's fetch-router: the platform's own remote MCP server, built
 * on `@sdxc/mcp`, exposing the management API as one tool per OpenAPI operation to an
 * agent holding a bearer token from the platform tenant's own OIDC engine. Served on
 * the bare platform domain, alongside — but kept apart from — the platform's own
 * public and dashboard pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import getClientIP from "@sdxc/get-client-ip/middleware";
import { log } from "@sdxc/logger/middleware";
import { createHandler } from "@sdxc/mcp";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import notFound from "~/app/http/controllers/not-found";
import { mcpAuth } from "~/app/http/middleware/mcp-auth";
import { mcpWellKnown } from "~/app/http/middleware/mcp-well-known";
import { MANAGEMENT_SECURITY_POLICY } from "~/app/http/security-policy";
import { managementToolHandler } from "~/app/mcp/controller";
import GENERATED_TOOLS from "~/app/mcp/tools";
import routes from "~/routes/mcp";

import { logger } from "./logger";

/**
 * How long a client may cache the tool list. The operation set changes only on
 * deploy, so an hour costs a client one re-listing a session rather than one a turn.
 */
const LIST_TTL_MS = 3_600_000;

/**
 * The platform's MCP server, built once at module scope like the route table in
 * `routes/web.ts`. Every tool is generated from the management API's own OpenAPI
 * operations, so they are mapped in a loop rather than declared and bound one by one.
 */
const mcp = createHandler({
	name: "auth-saas-management",
	title: "Auth SaaS Management API",
	version: "1.0.0",
	instructions:
		"Manage subjects, clients, agent clients, API keys, webhook endpoints, roles, credentials, audit events and tenant settings through the management API. Each tool maps one management API operation: pass its path variables as `params`, its query-string parameters as `query`, and its request body as `body`, each exactly as the operation's own OpenAPI document describes them.",
	listTtlMs: LIST_TTL_MS,
});

for (let generated of GENERATED_TOOLS) {
	mcp.tools.map(generated.tool, managementToolHandler(generated));
}

/** Kept as a non-tuple `Middleware[]` so the router context stays the base `RequestContext`. */
let globalMiddleware: Middleware[] = [
	log(logger) as Middleware,
	getClientIP(),
	trace() as Middleware,
	asyncContext(),
	securityHeaders(MANAGEMENT_SECURITY_POLICY) as Middleware,
	mcpWellKnown(`https://${env.PLATFORM_DOMAIN}`),
];

/**
 * The MCP router, configured with the global middleware chain and a `404` default
 * handler. `bootstrap/worker.ts` dispatches `/mcp` and this server's own protected-
 * resource metadata path to it, leaving every other bare-platform-domain path to the
 * platform's own router. `mcpAuth` is mounted on the `/mcp` route itself, not the
 * global chain, so a request for the protected-resource metadata is never refused for
 * lacking a bearer token it has no reason to carry.
 *
 * @example
 * return await mcpRouter.fetch(request);
 */
export const mcpRouter = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

mcpRouter.map(routes.mcp, { middleware: [mcpAuth()], handler: (ctx) => mcp.fetch(ctx) });
