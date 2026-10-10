/**
 * HTTP controller for the Atom 1.0 feeds, one per RSS feed and carrying the same entries,
 * for readers that prefer Atom's explicit ids, update times, and typed links. Each
 * advertises the WebSub hub in the document and the `Link` header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Atom } from "@sdxc/atom";
import { createController } from "remix/router";

import type { AppContext } from "~/app/http/context";
import type { Syndication } from "~/app/http/view-models/syndication";

import { syndicationChannel, syndicationEntries } from "~/app/http/view-models/syndication";
import { advertiseHub } from "~/app/services/websub";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/**
 * Serializes one stream as Atom. Entry ids are `urn:uuid:` IRIs over the post id, as
 * RFC 4287 requires an IRI, and the feed's `updated` is its newest edit, or now when empty.
 *
 * @param ctx Request context carrying the database and the request URL.
 * @param feed The route being served, whose URL is the feed's id and WebSub topic.
 * @param stream The content the feed carries.
 */
async function atomFeed(
	ctx: AppContext,
	feed: { href(): string },
	stream: Syndication.Stream,
): Promise<Response> {
	let channel = syndicationChannel(stream, ctx.url);
	let entries = await syndicationEntries(ctx.models, ctx.url, stream);
	let self = new URL(feed.href(), ctx.url).toString();
	let hub = advertiseHub(self, "application/atom+xml");

	let updated = entries.reduce(
		(latest, entry) => (entry.updated > latest ? entry.updated : latest),
		entries[0]?.updated ?? new Date().toISOString(),
	);

	let atom = new Atom({
		id: self,
		title: channel.title,
		subtitle: channel.description,
		updated,
		author: { name: PROFILE.name, uri: ctx.url.origin },
		link: [{ rel: "alternate", href: channel.home, type: "text/html" }, ...hub.atomLink],
		lang: "en",
	});

	for (let entry of entries) {
		atom.addEntry({
			id: `urn:uuid:${entry.id}`,
			title: entry.title,
			updated: entry.updated,
			published: entry.published,
			summary: entry.summary,
			link: { rel: "alternate", href: entry.url },
		});
	}

	return new Response(atom.toString(), {
		headers: { "content-type": "application/atom+xml; charset=utf-8", ...hub.headers },
	});
}

/** Serves the public Atom feeds, each omitting preview-only posts. */
export default createController(routes.atom, {
	middleware: [],
	actions: {
		/** The whole site's activity, glossary terms included, in one timeline. */
		feed: (ctx) => atomFeed(ctx, routes.atom.feed, "feed"),
		/** Published articles only. */
		articles: (ctx) => atomFeed(ctx, routes.atom.articles, "articles"),
		/** Published tutorials only. */
		tutorials: (ctx) => atomFeed(ctx, routes.atom.tutorials, "tutorials"),
		/** Saved links, each entry pointing at the bookmarked page. */
		bookmarks: (ctx) => atomFeed(ctx, routes.atom.bookmarks, "bookmarks"),
	},
});
