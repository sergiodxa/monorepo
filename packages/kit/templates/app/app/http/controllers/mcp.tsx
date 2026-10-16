/**
 * The MCP endpoint an agent connects to. It forwards each request to the app's MCP server,
 * whose tools and resources live in `app/mcp/`.
 */

import { createAction } from "remix/router";

import api from "~/app/http/middleware/api";
import mcp from "~/app/initializers/mcp";
import routes from "~/routes/api";

export default createAction(routes.mcp, {
	middleware: api,
	/** POST /mcp, answered over Streamable HTTP. */
	handler: (ctx) => mcp.fetch(ctx),
});
