/**
 * Answers the `json-patch.diff` MCP tool.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";

import toolset from "~/app/mcp/tools";
import { runPaidTool } from "~/app/mcp/tools/run-paid";

export default createTool(toolset.jsonPatchDiff, (ctx) =>
	runPaidTool("json-patch.diff", ctx.input),
);
