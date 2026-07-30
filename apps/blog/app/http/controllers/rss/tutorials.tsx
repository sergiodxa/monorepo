/**
 * HTTP action for the tutorials-only RSS feed. It loads published tutorials and emits an
 * RSS 2.0 document with channel and item links resolved as absolute URLs against the
 * current request origin, using stable fallbacks for missing metadata. It exists to serve
 * feed readers a dedicated, tenant-aware public tutorials channel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@pkg/http/response";
import { RSS } from "@pkg/rss";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { TutorialPost } from "~/app/repositories/posts/tutorial";
import routes from "~/routes/web";

/**
 * Serves the public tutorials feed as RSS XML.
 *
 * The feed is tenant-aware because links are resolved against the incoming request URL.
 */
export default createAction(
	routes.rss.tutorials,
	/**
	 * Builds the RSS payload for tutorials visible to the public.
	 *
	 * Contract:
	 * - include only records considered published by `Post.isPublishedAt`
	 * - emit absolute item and channel links using the current request origin
	 * - provide stable fallback values when optional metadata is missing
	 * @param ctx Request context exposing container bindings and canonical request URL.
	 * @returns XML response for feed readers polling the tutorials channel.
	 */
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let tutorials = await TutorialPost.findAll(db, { includePreview: false });

		let rss = new RSS({
			title: "Tutorials — Sergio Xalambrí",
			description: "Tutorials by Sergio Xalambrí.",
			link: new URL(routes.tutorials.href(), ctx.url).toString(),
		});

		for (let tutorial of tutorials) {
			let link = new URL(
				routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug }),
				ctx.url,
			).toString();
			rss.addItem({
				guid: tutorial.id,
				title: tutorial.meta.title,
				description: tutorial.meta.excerpt ?? link,
				link,
				pubDate: new Date(tutorial.published_at ?? tutorial.created_at).toUTCString(),
			});
		}

		return xml(rss.toString());
	}),
);
