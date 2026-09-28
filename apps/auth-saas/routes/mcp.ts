/**
 * The route table for the platform's MCP server: one endpoint, answering every method
 * the Streamable HTTP transport uses (`GET` for its SSE stream, `POST` for JSON-RPC
 * messages, `DELETE` to end a session).
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
