/**
 * Answers `read_timeline`: the reader's queue. Asking for the first page is opening the
 * reader, so it compares every subscription against the head its feed published and brings
 * back what it finds behind the answer; paging checks nothing, as a scrolled frame does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";
import { waitUntil } from "cloudflare:workers";

import type { UserStore } from "~/app/models/user-store";

import { agentPage, agentStore } from "~/app/mcp/page";
import toolset from "~/app/mcp/tools";

/**
 * Opens the reader's queue and brings whatever is stale up to date behind the answer.
 *
 * The check is the whole of what an agent is asking for when it asks what is new: without
 * it, an agent speaking for somebody away for a week reads a week-old queue as current.
 *
 * @param options - Which posts the page holds, and how many.
 */
async function opened(options: UserStore.ReadingQueueOptions) {
	let store = agentStore();
	let result = await store.openReader(options);

	if (result.freshness.count > 0) waitUntil(store.synchronize(result.freshness.stale));

	return agentPage(result.timeline);
}

/** The queue, checked for freshness on a first page and paged without checking after that. */
export default createTool(toolset.readTimeline, async (ctx) => {
	let options = {
		readState: ctx.input.readState,
		limit: ctx.input.limit,
		cursor: ctx.input.cursor ?? null,
	};

	if (ctx.input.cursor === undefined) return await opened(options);

	return agentPage(await agentStore().readingQueue(options));
});
