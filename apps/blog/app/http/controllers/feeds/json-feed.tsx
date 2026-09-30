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

import type { AppContext } from "~/app/http/context";
import type { Syndication } from "~/app/http/view-models/syndication";

import { syndicationChannel, syndicationEntries } from "~/app/http/view-models/syndication";
import { advertiseHub } from "~/app/services/websub";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/**
 * Serializes one stream as JSON Feed. Each item carries its summary as `content_text`,
 * since JSON Feed expects every item to hold a body.
 *
 * @param ctx Request context carrying the database and the request URL.
 * @param feed The route being served, whose URL is the feed's `feed_url` and WebSub topic.
 * @param stream The content the feed carries.
 */
async function jsonFeed(
	ctx: AppContext,
	feed: { href(): string },
	stream: Syndication.Stream,
): Promise<Response> {
	let channel = syndicationChannel(stream, ctx.url);
	let entries = await syndicationEntries(ctx.db, ctx.url, stream);
	let self = new URL(feed.href(), ctx.url).toString();
	let hub = advertiseHub(self, JSONFeed.mediaType);

	let document = new JSONFeed({
		title: channel.title,
		homePageUrl: channel.home,
		feedUrl: self,
		description: channel.description,
		authors: [{ name: PROFILE.name, url: ctx.url.origin }],
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
		feed: (ctx) => jsonFeed(ctx, routes.jsonFeed.feed, "feed"),
		/** Published articles only. */
		articles: (ctx) => jsonFeed(ctx, routes.jsonFeed.articles, "articles"),
		/** Published tutorials only. */
		tutorials: (ctx) => jsonFeed(ctx, routes.jsonFeed.tutorials, "tutorials"),
		/** Saved links, each item pointing at the bookmarked page. */
		bookmarks: (ctx) => jsonFeed(ctx, routes.jsonFeed.bookmarks, "bookmarks"),
	},
});
