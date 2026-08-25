/**
 * HTTP action for `GET /mcp`: the page explaining the MCP server that answers `POST` at
 * the same path.
 *
 * The lists come from the server's own declarations rather than from prose here, so the
 * page cannot describe a tool that was renamed or a resource that was never mapped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { walk, walkResources } from "@pkg/mcp";
import { createAction } from "remix/router";

import { MCP_RATE_LIMIT } from "~/app/mcp/rate-limit";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";
import { McpView } from "~/resources/views/mcp";
import routes from "~/routes/web";

/**
 * Serves the MCP documentation page.
 *
 * The endpoint is built from the request's own URL rather than hardcoded, so the address
 * the page tells a reader to paste is the one they are reading it at.
 *
 * @returns HTML response for `GET /mcp`.
 */
export default createAction(routes.mcp.index, async (ctx) => {
	let model: McpView.Model = {
		endpoint: new URL(routes.mcp.index.href(), ctx.url).toString(),
		tools: [...walk(toolset)].map((tool) => ({
			name: tool.descriptor.name,
			title: tool.descriptor.title,
			description: tool.descriptor.description,
		})),
		resources: [...walkResources(resourceset)].map((resource) => ({
			name: resource.descriptor.name,
			title: resource.descriptor.title,
			description: resource.descriptor.description,
			uriTemplate: resource.descriptor.uriTemplate,
		})),
		rateLimit: MCP_RATE_LIMIT,
	};

	return ctx.render(McpView, model);
});
