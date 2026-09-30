/**
 * HTTP controller for the RSS 2.0 feeds: the combined site feed and the per-type article,
 * tutorial, and bookmark feeds. Each advertises the WebSub hub so subscribers receive new
 * items as they are published.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@sdxc/http/response";
import { RSS } from "@sdxc/rss";
import { createController } from "remix/router";

import type { AppContext } from "~/app/http/context";
import type { Syndication } from "~/app/http/view-models/syndication";

import { syndicationChannel, syndicationEntries } from "~/app/http/view-models/syndication";
import { advertiseHub } from "~/app/services/websub";
import routes from "~/routes/web";

/**
 * Serializes one stream as RSS, dating each item by its publish time.
 *
 * @param ctx Request context carrying the database and the request URL.
 * @param feed The route being served, whose URL is the feed's WebSub topic.
 * @param stream The content the feed carries.
 */
async function rssFeed(
	ctx: AppContext,
	feed: { href(): string },
	stream: Syndication.Stream,
): Promise<Response> {
	let channel = syndicationChannel(stream, ctx.url);
	let entries = await syndicationEntries(ctx.db, ctx.url, stream);
	let hub = advertiseHub(new URL(feed.href(), ctx.url).toString());

	let rss = new RSS({
		title: channel.title,
		description: channel.description,
		link: channel.home,
		atomLink: hub.atomLink,
	});

	for (let entry of entries) {
		rss.addItem({
			guid: entry.id,
			title: entry.title,
			description: entry.summary,
			link: entry.url,
			pubDate: new Date(entry.published).toUTCString(),
		});
	}

	return xml(rss.toString(), { headers: hub.headers });
}

/** Serves the public RSS feeds, each omitting preview-only posts. */
export default createController(routes.rss, {
	middleware: [],
	actions: {
		/** The whole site's activity, glossary terms included, in one timeline. */
		feed: (ctx) => rssFeed(ctx, routes.rss.feed, "feed"),
		/** Published articles only. */
		articles: (ctx) => rssFeed(ctx, routes.rss.articles, "articles"),
		/** Published tutorials only. */
		tutorials: (ctx) => rssFeed(ctx, routes.rss.tutorials, "tutorials"),
		/** Saved links, each item pointing at the bookmarked page. */
		bookmarks: (ctx) => rssFeed(ctx, routes.rss.bookmarks, "bookmarks"),
	},
});
