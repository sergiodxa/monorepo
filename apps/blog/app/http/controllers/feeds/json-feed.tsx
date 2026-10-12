/**
 * HTTP controller for the JSON Feed 1.1 feeds, one per RSS feed and carrying the same
 * items, for readers and tools that consume JSON directly. Each advertises the WebSub hub
 * in the document's `hubs` and the `Link` header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JSONFeed } from "@sdxc/json-feed";
import { createController } from "remix/router";

import type { Syndication } from "~/app/http/view-models/syndication";

import { NotFoundViewModel } from "~/app/http/view-models/not-found";
import { syndicationChannel, syndicationEntries } from "~/app/http/view-models/syndication";
import { TOPIC_NOT_FOUND, TopicViewModel } from "~/app/http/view-models/topic";
import { findKindTopic, topicFeedPosts } from "~/app/services/topics";
import { advertiseHub } from "~/app/services/websub";
import { PROFILE } from "~/config/profile";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

/**
 * Serializes a feed as JSON Feed. Each item carries its summary as `content_text`, since
 * JSON Feed expects every item to hold a body.
 *
 * @param self The feed's absolute URL, which is its `feed_url` and WebSub topic.
 * @param channel The feed's own metadata.
 * @param entries The items, in the order they are listed.
 * @param origin The site's origin, which names the feed's author.
 */
export function jsonFeedResponse(
	self: string,
	channel: Syndication.Channel,
	entries: ReadonlyArray<Syndication.Entry>,
	origin: string,
): Response {
	let hub = advertiseHub(self, JSONFeed.mediaType);

	let document = new JSONFeed({
		title: channel.title,
		homePageUrl: channel.home,
		feedUrl: self,
		description: channel.description,
		authors: [{ name: PROFILE.name, url: origin }],
		language: "en",
		hubs: [{ type: "WebSub", url: hub.hubUrl }],
	});

	for (let entry of entries) {
		document.addItem({
			id: entry.id,
			url: entry.url,
			title: entry.title,
			contentText: entry.summary,
			datePublished: entry.published,
			dateModified: entry.updated,
		});
	}

	return new Response(document.toString(), {
		headers: { "content-type": `${JSONFeed.mediaType}; charset=utf-8`, ...hub.headers },
	});
}

/** Serves the public JSON Feeds, each omitting preview-only posts. */
export default createController(routes.jsonFeed, {
	middleware: [],
	actions: {
		/** The whole site's activity, glossary terms included, in one timeline. */
		async feed(ctx) {
			let self = new URL(routes.jsonFeed.feed.href(), ctx.url).toString();
			let entries = await syndicationEntries(ctx.models, ctx.url, "feed");
			return jsonFeedResponse(self, syndicationChannel("feed", ctx.url), entries, ctx.url.origin);
		},

		/**
		 * A kind's topic, newest first: `/articles.json` carries what `/articles` lists. A name
		 * no kind's topic has answers 404.
		 */
		async topic(ctx) {
			let topic = await findKindTopic(ctx.models, ctx.params.topic);
			if (topic === null) {
				return ctx.render(NotFoundView, NotFoundViewModel.page(TOPIC_NOT_FOUND), { status: 404 });
			}
			let self = new URL(routes.jsonFeed.topic.href({ topic: topic.slug }), ctx.url).toString();
			let feed = TopicViewModel.feed(topic, await topicFeedPosts(ctx, topic), ctx.url);
			return jsonFeedResponse(self, feed.channel, feed.entries, ctx.url.origin);
		},
	},
});
