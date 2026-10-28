/**
 * Answers `list_jobs`: the newest open positions as summaries, for an agent that has no
 * query yet and wants to see what the board holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { summarize } from "~/app/mcp/postings";
import toolset from "~/app/mcp/tools";

export default createTool(toolset.listJobs, async (ctx) => {
	let open = await ctx.models.postings.listOpen(ctx.input.limit);
	return open.map(summarize);
});
