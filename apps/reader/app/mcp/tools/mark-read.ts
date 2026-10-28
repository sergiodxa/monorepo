/**
 * Answers `mark_read`: marks one post read or puts it back among the unread. Idempotent, so
 * a repeated call leaves the post where the first one left it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { WRITES } from "~/app/mcp/agent";
import { agentStore } from "~/app/mcp/page";
import { NO_SUCH_POST } from "~/app/mcp/refusals";
import toolset from "~/app/mcp/tools";

/** Marks one post read, or puts it back among the unread. */
export default createTool(toolset.markRead, {
	...WRITES,
	handler: async (ctx) => {
		let marked = await agentStore().markRead(ctx.input.itemId, ctx.input.read);
		if (!marked) throw new ToolError(NO_SUCH_POST);

		return { read: ctx.input.read };
	},
});
