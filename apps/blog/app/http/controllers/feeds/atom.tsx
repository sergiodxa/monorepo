/**
 * HTTP controller for the Atom 1.0 feeds, one per RSS feed and carrying the same entries,
 * for readers that prefer Atom's explicit ids, update times, and typed links. Each
 * advertises the WebSub hub in the document and the `Link` header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Atom } from "@sdxc/atom";
import { text } from "@sdxc/http/response";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
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
 * Serializes a feed as Atom. Entry ids are `urn:uuid:` IRIs over the post id, as RFC 4287
 * requires an IRI, and the feed's `updated` is its newest edit, or now when empty. Every
 * feed lists all its posts, so it is marked `fh:complete` for readers to drop removed ones.
 * Data the Atom writer refuses is logged and answered with a 500.
 *
 * @param self The feed's absolute URL, which is its id and WebSub topic.
 * @param channel The feed's own metadata.
 * @param entries The entries, in the order they are listed.
 * @param origin The site's origin, which names the feed's author.
 */
export function atomResponse(
	self: string,
	channel: Syndication.Channel,
	entries: ReadonlyArray<Syndication.Entry>,
	origin: string,
): Response {
	let hub = advertiseHub(self, "application/atom+xml");

	let updated = entries.reduce(
		(latest, entry) => (entry.updated > latest ? entry.updated : latest),
		entries[0]?.updated ?? new Date().toISOString(),
	);

	let xml = Atom.stringify({
		feed: {
			id: self,
			title: channel.title,
			subtitle: channel.description,
			updated,
			author: { name: PROFILE.name, uri: origin },
			link: [{ rel: "alternate", href: channel.home, type: "text/html" }, ...hub.atomLink],
			lang: "en",
			complete: true,
		},
		entries: entries.map((entry) => ({
			id: `urn:uuid:${entry.id}`,
			title: entry.title,
			updated: entry.updated,
			published: entry.published,
			summary: entry.summary,
			link: { rel: "alternate", href: entry.url },
		})),
	});

	if (isFailure(xml)) {
		currentLog()?.fail(xml.error, { feed: self });
		return text("Internal Server Error", { status: 500 });
	}

	return new Response(xml.data, {
		headers: { "content-type": "application/atom+xml; charset=utf-8", ...hub.headers },
	});
}

/** Serves the public Atom feeds, each omitting preview-only posts. */
export default createController(routes.atom, {
	middleware: [],
	actions: {
		/** The whole site's activity, glossary terms included, in one timeline. */
		async feed(ctx) {
			let self = new URL(routes.atom.feed.href(), ctx.url).toString();
			let entries = await syndicationEntries(ctx.models, ctx.url);
			return atomResponse(self, syndicationChannel(ctx.url), entries, ctx.url.origin);
		},

		/**
		 * A kind's topic, newest first: `/articles.atom` carries what `/articles` lists. A name
		 * no kind's topic has answers 404.
		 */
		async topic(ctx) {
			let topic = await findKindTopic(ctx.models, ctx.params.topic);
			if (topic === null) {
				return ctx.render(NotFoundView, NotFoundViewModel.page(TOPIC_NOT_FOUND), { status: 404 });
			}
			let self = new URL(routes.atom.topic.href({ topic: topic.slug }), ctx.url).toString();
			let feed = TopicViewModel.feed(topic, await topicFeedPosts(ctx, topic), ctx.url);
			return atomResponse(self, feed.channel, feed.entries, ctx.url.origin);
		},
	},
});
