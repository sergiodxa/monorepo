/**
 * Answers `read_feed`: one followed feed's posts, read and unread alike, which is the same
 * list the web app renders for that feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { agentPage, agentStore } from "~/app/mcp/page";
import toolset from "~/app/mcp/tools";

/** One page of the feed's posts, newest first. */
export default createTool(toolset.readFeed, async (ctx) =>
	agentPage(
		await agentStore().feedTimeline(ctx.input.feedId, {
			limit: ctx.input.limit,
			cursor: ctx.input.cursor ?? null,
		}),
	),
);
