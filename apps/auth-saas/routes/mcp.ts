/**
 * The route table for the platform's MCP server: one endpoint, answering the
 * stateless Streamable HTTP transport's `POST` JSON-RPC requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { route } from "remix/routes";

/**
 * The MCP router's route map.
 *
 * @example
 * routes.mcp.href();
 */
export default route({
	mcp: "/mcp",
});
