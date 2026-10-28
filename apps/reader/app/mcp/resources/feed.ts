/**
 * Serves the reader's own feeds as resources a person can attach. The enumeration is their
 * subscription list, theirs alone: no argument names a reader, and the only object
 * reachable is the one the token resolved to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import { agentPage, agentStore, reported, toAgentFeed } from "~/app/mcp/page";
import resourceset from "~/app/mcp/resources";

/** Posts one feed's resource carries, which is enough to say what a publication is like. */
const FEED_RESOURCE_POSTS = 20;

/** Lists every followed feed by URI, and reads one back with its newest posts. */
export default createResource(resourceset.feed, {
	list: async () => {
		let feeds = await agentStore().listFeeds();

		return feeds.map((feed) => ({
			uri: resourceset.feed.href({ feedId: feed.id }),
			name: feed.id,
			title: feed.title,
			mimeType: "application/json",
		}));
	},

	read: async (ctx) => {
		let store = agentStore();
		let feed = await store.getFeed(ctx.variables.feedId);
		if (feed === null) return reported("feed", null);

		let page = agentPage(await store.feedTimeline(feed.id, { limit: FEED_RESOURCE_POSTS }));

		return reported(
			"feed",
			JSON.stringify({ feed: toAgentFeed(feed), posts: page.posts }, null, 2),
		);
	},
});
