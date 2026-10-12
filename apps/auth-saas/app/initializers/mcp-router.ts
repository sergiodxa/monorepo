/**
 * The MCP router for `routes/mcp.ts`: the platform's remote MCP server on the bare platform
 * domain, alongside — but apart from — the platform's own public and dashboard pages, plus
 * the protected-resource metadata an agent reads to find where to get a token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import getClientIP from "@sdxc/get-client-ip/middleware";
import { log } from "@sdxc/logger/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import notFound from "~/app/http/controllers/not-found";
import { mcpAuth } from "~/app/http/middleware/mcp-auth";
import { mcpWellKnown } from "~/app/http/middleware/mcp-well-known";
import { logger } from "~/app/initializers/logger";
import { MANAGEMENT_SECURITY_POLICY } from "~/config/security-policy";
import routes from "~/routes/mcp";

/**
 * The MCP router, with a `404` default handler. `bootstrap/worker.ts` dispatches `/mcp`
 * and the protected-resource metadata path to it. `mcpAuth` guards the `/mcp` route alone,
 * so a request for the metadata is answered without a bearer token it has no reason to carry.
 *
 * @example
 * return await mcpRouter.fetch(request);
 */
export const mcpRouter = createRouter({
	middleware: [
		log(logger),
		getClientIP(),
		trace(),
		asyncContext(),
		securityHeaders(MANAGEMENT_SECURITY_POLICY),
		mcpWellKnown(`https://${env.PLATFORM_DOMAIN}`),
	],
	defaultHandler: notFound,
});

mcpRouter.map(routes.mcp, {
	middleware: [mcpAuth()],
	/**
	 * Imports the server on the first call, which keeps the generated tool list and the
	 * management API's OpenAPI document off every other cold start.
	 */
	handler: async (ctx) => (await import("~/app/initializers/mcp")).default.fetch(ctx),
});
