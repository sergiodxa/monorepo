/**
 * The five tools about subscriptions, and the resource a person attaches one feed with.
 *
 * The tool and the enumerator run the same query and are not redundant: the listing gives a
 * person's picker a name and a URI, while the tool gives a model unread counts and
 * publishing rates, which is what it needs to decide where to look.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource, createToolController, ToolError } from "@sdxc/mcp";

import type { UserStore } from "~/database/user-do";

import { mayWrite, requireWriteScope } from "~/app/mcp/agent";
import { agentPage, agentStore, reported, toAgentFeed } from "~/app/mcp/page";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";

/** Posts one feed's resource carries, which is enough to say what a publication is like. */
const FEED_RESOURCE_POSTS = 20;

/** What a writing tool declares about itself, hidden and refused alike for a read token. */
const WRITES = { available: mayWrite, middleware: [requireWriteScope()] };

/** The sentence a tool answers with when the reader follows no such feed. */
const NO_SUCH_FEED = "This reader follows no feed with that id. Call list_feeds to see them.";

/** Answers the five tools about a reader's subscriptions. */
export default createToolController(toolset.feeds, {
	actions: {
		/** Every followed feed, with the counts a model decides where to look from. */
		list: async () => {
			let feeds = await agentStore().listFeeds();
			return { feeds: feeds.map(toAgentFeed) };
		},

		/** One feed, including the rate the object that fetches it measured. */
		get: async (ctx) => {
			let feed = await agentStore().getFeed(ctx.input.feedId);
			if (feed === null) throw new ToolError(NO_SUCH_FEED);

			return toAgentFeed(feed);
		},

		/** Follows whatever a URL leads to, and reports what came back with it. */
		follow: {
			...WRITES,
			handler: async (ctx) => {
				let followed = await agentStore().followFeed(ctx.input.url);

				if (!followed.ok) throw new ToolError(followFailure(followed.reason));

				return { feed: toAgentFeed(followed.feed), posts: followed.items };
			},
		},

		/**
		 * Stops following one feed. Its unread posts go with it and the kept ones stay, which
		 * is what the answer reports so a model can say what actually happened.
		 */
		unfollow: {
			...WRITES,
			handler: async (ctx) => {
				let unfollowed = await agentStore().unfollowFeed(ctx.input.feedId);
				if (!unfollowed) throw new ToolError(NO_SUCH_FEED);

				return { unfollowed: true };
			},
		},

		/** Takes one feed's unread posts out of the queue, and reports how many that was. */
		markRead: {
			...WRITES,
			handler: async (ctx) => ({ marked: await agentStore().markFeedRead(ctx.input.feedId) }),
		},
	},
});

/**
 * The sentence a refused follow answers with, written so a model knows what would work.
 *
 * @param reason - What the reader's own object said about the address.
 */
function followFailure(reason: UserStore.FollowFailure): string {
	if (reason === "invalid-url")
		return "That is not an HTTP address, so there is nothing to follow.";
	if (reason === "not-found")
		return "That address was reached, but it advertises no RSS or Atom feed.";
	if (reason === "unreachable") return "That address could not be reached. Try again later.";
	if (reason === "already-following") return "This reader already follows that feed.";

	return "This reader already follows as many feeds as their plan allows.";
}

/**
 * Serves the reader's own feeds as resources a person can attach.
 *
 * The enumeration is their subscription list, which is theirs alone: no argument here names
 * a reader, and the only object reachable is the one the token resolved to.
 */
export const feedResource = createResource(resourceset.feed, {
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
