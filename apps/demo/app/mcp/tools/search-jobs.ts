/**
 * Answers `search_jobs`: the open positions whose title, company or location match the
 * query, as the summaries a model ranks by. Reading one in full is `get_job`'s job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { summarize } from "~/app/mcp/postings";
import toolset from "~/app/mcp/tools";

export default createTool(toolset.searchJobs, async (ctx) => {
	let found = await ctx.models.postings.search(ctx.input.query, ctx.input.limit);
	return found.map(summarize);
});
