/**
 * Answers `read_saved`: the shelf of posts the reader chose to keep, which no rule that
 * deletes a post reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { agentPage, agentStore } from "~/app/mcp/page";
import toolset from "~/app/mcp/tools";

/** One page of the shelf, newest first. */
export default createTool(toolset.readSaved, async (ctx) =>
	agentPage(
		await agentStore().savedQueue({
			limit: ctx.input.limit,
			cursor: ctx.input.cursor ?? null,
		}),
	),
);
