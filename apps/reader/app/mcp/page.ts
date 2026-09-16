/**
 * What a page of posts looks like once it has crossed to a model: the fields a reader would
 * see in a row, the feed each came from, and one opaque reference to the page after it.
 *
 * A model pays for what comes back in context tokens, so nothing here carries a body, a
 * second copy of a feed's details, or a backwards cursor a model would pick the wrong one
 * of. Every string on it was written by a publisher, so it is data rather than instruction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";
import { ToolError } from "@sdxc/mcp";

import type { UserStore } from "~/database/user-do";

import { currentAgent } from "~/app/mcp/agent";
import { userStore } from "~/database/user-do";

/** One post as a model reads it, which is a row of a list and the link to the publisher. */
export interface AgentPost {
	id: string;
	feedId: string;
	/** The feed's own name, carried here so a list needs no second lookup to be readable. */
	feed: string;
	title: string;
	/** The publisher's own address for it, which is the one a client can follow. */
	url: string | null;
	summary: string | null;
	author: string | null;
	publishedAt: string;
	read: boolean;
	saved: boolean;
}

/** One page of posts, and the one reference that reaches the page after it. */
export interface AgentPage {
	posts: AgentPost[];
	/** Pass back verbatim for the next page; `null` when this was the last one. */
	nextCursor: string | null;
}

/** The store holding the reader this request's token resolved to, and no other. */
export function agentStore() {
	return userStore(currentAgent().subject);
}

/**
 * Projects one timeline page for a model, reporting a page reference it can no longer
 * follow as something it can act on.
 *
 * A cursor that no longer decodes answers a failure rather than the first page, because
 * silently restarting looks to an agent like a loop that never ends.
 *
 * @param result - The page the reader's own object answered with.
 * @throws ToolError When the cursor the model passed back no longer decodes.
 */
export function agentPage(result: UserStore.TimelineResult): AgentPage {
	if (!result.ok) {
		throw new ToolError(
			"That page reference has expired. Ask for the same list again without a cursor, then page forward from the reference that call returns.",
		);
	}

	let names = new Map(result.feeds.map((feed) => [feed.id, feed.title]));

	return {
		posts: result.items.map((item) => toAgentPost(item, names.get(item.feedId) ?? "")),
		nextCursor: result.cursors.next,
	};
}

/**
 * One stored post as a model reads it.
 *
 * Timestamps cross as ISO strings rather than as the epoch milliseconds they are stored in,
 * since a model reasons about a date it can read and the two never have to be compared.
 *
 * @param item - The post as the RPC boundary reported it.
 * @param feed - The name of the feed it came from.
 */
export function toAgentPost(item: UserStore.Item, feed: string): AgentPost {
	return {
		id: item.id,
		feedId: item.feedId,
		feed,
		title: item.title,
		url: item.url,
		summary: item.summary,
		author: item.author,
		publishedAt: new Date(item.publishedAt).toISOString(),
		read: item.readAt !== null,
		saved: item.savedAt !== null,
	};
}

/** One followed feed as a model reads it, which is what it decides where to look from. */
export function toAgentFeed(feed: UserStore.FeedSummary) {
	return {
		id: feed.id,
		title: feed.title,
		siteUrl: feed.siteUrl,
		feedUrl: feed.feedUrl,
		description: feed.description,
		unreadCount: feed.unreadCount,
		/** What the feed publishes, as its own object measured it, or `null` before any. */
		postsPerDay: feed.postsPerDay,
		folder: feed.folderTitle,
	};
}

/**
 * Records that one resource was read, in the two facts that are safe to keep: which
 * declaration answered, and whether this reader held it. A URI names a feed or a post, so
 * it stays out of the record.
 *
 * @param resource - The declaration's own name.
 * @param contents - What the read produced, or `null` for a resource this reader lacks.
 * @returns `contents` unchanged, so a read reports and answers in one expression.
 */
export function reported(resource: string, contents: string | null): string | null {
	currentLog()?.note("mcp.resource", { resource, found: contents !== null });
	return contents;
}
