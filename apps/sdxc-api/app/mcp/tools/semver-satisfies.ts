/**
 * Answers the `semver.satisfies` MCP tool.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import toolset from "~/app/mcp/tools";
import { runPaidTool } from "~/app/mcp/tools/run-paid";

export default createTool(toolset.semverSatisfies, (ctx) =>
	runPaidTool("semver.satisfies", ctx.input),
);
