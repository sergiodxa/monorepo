/**
 * The tools the MCP server offers: the name a client calls, the description a model chooses
 * it by, and the schema its arguments satisfy. Each handler lives in its own file beside
 * this one.
 */

import { tools } from "@sdxc/mcp/server";

/** The app's tools; `sdxc make mcp <name>` declares one here and maps its handler. */
export default tools({});
