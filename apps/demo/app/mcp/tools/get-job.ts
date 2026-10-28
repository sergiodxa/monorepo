/**
 * Answers `get_job`: one position in full as Markdown, or a `ToolError` that points the
 * model back to `search_jobs` when the id matches nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { toMarkdown } from "~/app/mcp/postings";
import toolset from "~/app/mcp/tools";

export default createTool(toolset.getJob, async (ctx) => {
	let posting = await ctx.models.postings.find(ctx.input.id);
	if (posting === null) throw new ToolError("No position has that id. Find one with search_jobs.");
	return toMarkdown(posting);
});
