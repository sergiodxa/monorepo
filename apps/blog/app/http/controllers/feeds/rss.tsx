/**
 * HTTP controller for the RSS 2.0 feeds: the combined site feed, and the feed of each kind's
 * topic at `/<topic>.rss`. Each advertises the WebSub hub so subscribers receive new items
 * as they are published.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text, xml } from "@sdxc/http/response";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { RSS } from "@sdxc/rss";
import { createController } from "remix/router";

import type { Syndication } from "~/app/http/view-models/syndication";

import { NotFoundViewModel } from "~/app/http/view-models/not-found";
import { syndicationChannel, syndicationEntries } from "~/app/http/view-models/syndication";
import { TOPIC_NOT_FOUND, TopicViewModel } from "~/app/http/view-models/topic";
import { findKindTopic, topicFeedPosts } from "~/app/services/topics";
import { advertiseHub } from "~/app/services/websub";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

/**
 * Serializes a feed as RSS, dating each item by its publish time. Every feed lists all its
 * posts, so it is marked `fh:complete` for readers to drop removed ones. Data the RSS writer
 * refuses is logged and answered with a 500.
 *
 * @param self The feed's absolute URL, which is its WebSub topic.
 * @param channel The feed's own metadata.
 * @param entries The items, in the order they are listed.
 */
export function rssResponse(
	self: string,
	channel: Syndication.Channel,
	entries: ReadonlyArray<Syndication.Entry>,
): Response {
	let hub = advertiseHub(self);

	let rss = RSS.stringify({
		channel: {
			title: channel.title,
			description: channel.description,
			link: channel.home,
			atomLink: hub.atomLink,
			fhComplete: true,
		},
		items: entries.map((entry) => ({
			guid: entry.id,
			title: entry.title,
			description: entry.summary,
			link: entry.url,
			pubDate: new Date(entry.published).toUTCString(),
		})),
	});

	if (isFailure(rss)) {
		currentLog()?.fail(rss.error, { feed: self });
		return text("Internal Server Error", { status: 500 });
	}

	return xml(rss.data, { headers: hub.headers });
}

/** Serves the public RSS feeds, each omitting preview-only posts. */
export default createController(routes.rss, {
	middleware: [],
	actions: {
		/** The whole site's activity, glossary terms included, in one timeline. */
		async feed(ctx) {
			let self = new URL(routes.rss.feed.href(), ctx.url).toString();
			let entries = await syndicationEntries(ctx.models, ctx.url);
			return rssResponse(self, syndicationChannel(ctx.url), entries);
		},

		/**
		 * A kind's topic, newest first: `/articles.rss` carries what `/articles` lists. A name
		 * no kind's topic has answers 404.
		 */
		async topic(ctx) {
			let topic = await findKindTopic(ctx.models, ctx.params.topic);
			if (topic === null) {
				return ctx.render(NotFoundView, NotFoundViewModel.page(TOPIC_NOT_FOUND), { status: 404 });
			}
			let self = new URL(routes.rss.topic.href({ topic: topic.slug }), ctx.url).toString();
			let feed = TopicViewModel.feed(topic, await topicFeedPosts(ctx, topic), ctx.url);
			return rssResponse(self, feed.channel, feed.entries);
		},
	},
});
