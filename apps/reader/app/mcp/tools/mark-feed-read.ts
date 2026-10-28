/**
 * Answers `mark_feed_read`: takes every unread post of one feed out of the queue at once,
 * and reports how many that was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { WRITES } from "~/app/mcp/agent";
import { agentStore } from "~/app/mcp/page";
import toolset from "~/app/mcp/tools";

/** Takes one feed's unread posts out of the queue, and reports how many that was. */
export default createTool(toolset.markFeedRead, {
	...WRITES,
	handler: async (ctx) => ({ marked: await agentStore().markFeedRead(ctx.input.feedId) }),
});
