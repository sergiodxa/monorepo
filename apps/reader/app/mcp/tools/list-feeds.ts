/**
 * Answers `list_feeds`: every followed feed with its unread count and publishing rate,
 * which is what a model decides where to look from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { agentStore, toAgentFeed } from "~/app/mcp/page";
import toolset from "~/app/mcp/tools";

/** Every followed feed, with the counts a model decides where to look from. */
export default createTool(toolset.listFeeds, async () => {
	let feeds = await agentStore().listFeeds();
	return { feeds: feeds.map(toAgentFeed) };
});
