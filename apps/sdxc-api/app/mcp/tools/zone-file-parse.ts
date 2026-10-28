/**
 * Answers the `zone-file.parse` MCP tool.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import toolset from "~/app/mcp/tools";
import { runPaidTool } from "~/app/mcp/tools/run-paid";

export default createTool(toolset.zoneFileParse, (ctx) =>
	runPaidTool("zone-file.parse", ctx.input),
);
