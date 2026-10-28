/**
 * Answers `save_post`: keeps one post on the reader's shelf or stops keeping it, refusing
 * rather than evicting when the shelf is full. Idempotent, like `mark_read`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { WRITES } from "~/app/mcp/agent";
import { agentStore } from "~/app/mcp/page";
import { NO_SUCH_POST } from "~/app/mcp/refusals";
import toolset from "~/app/mcp/tools";

/** Keeps one post, or stops keeping it, refusing rather than evicting a full shelf. */
export default createTool(toolset.savePost, {
	...WRITES,
	handler: async (ctx) => {
		let kept = await agentStore().saveItem(ctx.input.itemId, ctx.input.saved);

		if (!kept.ok && kept.reason === "not-found") throw new ToolError(NO_SUCH_POST);

		if (!kept.ok && kept.reason === "switched-off") {
			throw new ToolError(
				"Keeping posts is turned off for now, so nothing was kept. Posts already kept stay kept.",
			);
		}

		if (!kept.ok) {
			throw new ToolError(
				"This reader's shelf is full, so nothing was kept. They can stop keeping something first.",
			);
		}

		return { saved: kept.saved };
	},
});
