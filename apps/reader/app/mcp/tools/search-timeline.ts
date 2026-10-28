/**
 * Answers `search_timeline`: the reader's queue narrowed to words, which is one read of the
 * same queue rather than a second index.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { agentPage, agentStore } from "~/app/mcp/page";
import toolset from "~/app/mcp/tools";

/** One page of the queue holding every word of the query. */
export default createTool(toolset.searchTimeline, async (ctx) =>
	agentPage(
		await agentStore().readingQueue({
			query: ctx.input.query,
			readState: ctx.input.readState,
			limit: ctx.input.limit,
			cursor: ctx.input.cursor ?? null,
		}),
	),
);
