/**
 * The resources the MCP server offers, each addressed by a URI pattern a client reads and a
 * person attaches to a conversation. Each handler lives in its own file beside this one.
 */

import { resources } from "@sdxc/mcp/server";

/** The app's resources; `sdxc make mcp <name> --resource` declares one here and maps it. */
export default resources({});
