/**
 * The four reading tools, which are the four lists this app already renders as HTML: the
 * queue, a search inside it, one feed, and the shelf of kept posts.
 *
 * Asking for the first page of the queue is opening the reader, so it compares every
 * subscription against the head its feed published and brings back what it finds behind the
 * answer. Paging checks nothing, which is the same rule a scrolled frame has always run
 * under: an agent walking fifty posts pays for one check rather than three.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createToolController } from "@sdxc/mcp";
import { waitUntil } from "cloudflare:workers";

import type { UserStore } from "~/database/user-do";

import { agentPage, agentStore } from "~/app/mcp/page";
import toolset from "~/app/mcp/tools";

/**
 * Opens the reader's queue and brings whatever is stale up to date behind the answer.
 *
 * The check is the whole of what an agent is asking for when it asks what is new: without
 * it, an agent speaking for somebody who has not opened the app in a week reads a week-old
 * queue and reports it as current.
 *
 * @param options - Which posts the page holds, and how many.
 */
async function opened(options: UserStore.ReadingQueueOptions) {
	let store = agentStore();
	let result = await store.openReader(options);

	if (result.freshness.count > 0) waitUntil(store.synchronize(result.freshness.stale));

	return agentPage(result.timeline);
}

/** Answers the four reading tools, each one page of a list the web app already renders. */
export default createToolController(toolset.timeline, {
	actions: {
		/**
		 * The queue, checked for freshness on a first page and paged without checking after
		 * that.
		 */
		read: async (ctx) => {
			let options = {
				readState: ctx.input.readState,
				limit: ctx.input.limit,
				cursor: ctx.input.cursor ?? null,
			};

			if (ctx.input.cursor === undefined) return await opened(options);

			return agentPage(await agentStore().readingQueue(options));
		},

		/** The same queue narrowed to words, which is one read rather than a second index. */
		search: async (ctx) =>
			agentPage(
				await agentStore().readingQueue({
					query: ctx.input.query,
					readState: ctx.input.readState,
					limit: ctx.input.limit,
					cursor: ctx.input.cursor ?? null,
				}),
			),

		/** One feed's posts, read and unread alike. */
		feed: async (ctx) =>
			agentPage(
				await agentStore().feedTimeline(ctx.input.feedId, {
					limit: ctx.input.limit,
					cursor: ctx.input.cursor ?? null,
				}),
			),

		/** The shelf, which no rule that deletes a post reaches. */
		saved: async (ctx) =>
			agentPage(
				await agentStore().savedQueue({
					limit: ctx.input.limit,
					cursor: ctx.input.cursor ?? null,
				}),
			),
	},
});
