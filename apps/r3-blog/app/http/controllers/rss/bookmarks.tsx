import { xml } from "@pkg/http/response";
import { RSS } from "@pkg/rss";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { LikePost } from "~/app/repositories/posts/like";
import routes from "~/routes/web";

/**
 * Serves the public bookmarks RSS feed consumed by feed readers.
 *
 * Contract: always responds with XML generated from persisted like records, using
 * the current request origin to produce canonical absolute links.
 */
export default createAction(
	routes.rss.bookmarks,
	/**
	 * Builds the bookmarks channel and serializes each liked URL as one RSS item.
	 *
	 * @param ctx Route action context with DI access and request URL data.
	 * @returns XML response ready for RSS clients and aggregators.
	 */
	async (ctx) => {
		let database = ctx.get(Database);

		let likes = await LikePost.findAll(database);

		let rss = new RSS({
			title: "Bookmarks — Sergio Xalambrí",
			description: "Bookmarks by Sergio Xalambrí.",
			link: new URL(routes.bookmarks.href(), ctx.url).toString(),
		});

		for (let like of likes) {
			rss.addItem({
				guid: like.id,
				title: like.meta.title,
				description: like.meta.url,
				link: like.meta.url,
				pubDate: new Date(like.created_at).toUTCString(),
			});
		}

		return xml(rss.toString());
	},
);
