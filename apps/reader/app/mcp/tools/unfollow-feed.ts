/**
 * Answers `unfollow_feed`: stops following one feed. Its unread posts go with it and the
 * kept ones stay, which is what the answer reports so a model can say what happened.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { WRITES } from "~/app/mcp/agent";
import { agentStore } from "~/app/mcp/page";
import { NO_SUCH_FEED } from "~/app/mcp/refusals";
import toolset from "~/app/mcp/tools";

/** Stops following one feed, refusing an id the reader does not follow. */
export default createTool(toolset.unfollowFeed, {
	...WRITES,
	handler: async (ctx) => {
		let unfollowed = await agentStore().unfollowFeed(ctx.input.feedId);
		if (!unfollowed) throw new ToolError(NO_SUCH_FEED);

		return { unfollowed: true };
	},
});
