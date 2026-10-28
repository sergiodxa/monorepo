/**
 * Answers `get_feed`: one followed feed's details, including the rate the object that
 * fetches it measured, or a refusal pointing back to `list_feeds`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { agentStore, toAgentFeed } from "~/app/mcp/page";
import { NO_SUCH_FEED } from "~/app/mcp/refusals";
import toolset from "~/app/mcp/tools";

/** One feed, including the rate the object that fetches it measured. */
export default createTool(toolset.getFeed, async (ctx) => {
	let feed = await agentStore().getFeed(ctx.input.feedId);
	if (feed === null) throw new ToolError(NO_SUCH_FEED);

	return toAgentFeed(feed);
});
