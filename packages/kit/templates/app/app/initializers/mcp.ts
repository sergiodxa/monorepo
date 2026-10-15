/**
 * The app's MCP server. `app/mcp/tools/` and `app/mcp/resources/` declare what it offers and
 * answer it, one file per handler; `sdxc make mcp` maps each new handler here through
 * `lazy()`, so a request imports only the handlers it reaches.
 */

import { createHandler } from "@sdxc/mcp";

/** The handler the `/mcp` route forwards to. */
const mcp = createHandler({
	name: "app",
	version: "1.0.0",
	cacheScope: "public",
});

export default mcp;
