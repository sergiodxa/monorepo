/**
 * HTTP action for the articles-only RSS feed. It loads published articles, builds an
 * RSS 2.0 document with channel metadata pointing at the articles index, and emits one
 * item per article using absolute canonical URLs and a `created_at` publish-date fallback.
 * It exists to give feed readers a dedicated, public articles channel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@pkg/http/response";
import { RSS } from "@pkg/rss";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { ArticlePost } from "~/app/repositories/posts/article";
import routes from "~/routes/web";

/**
 * Serves the articles RSS feed consumed by feed readers and crawlers.
 *
 * The payload includes only public articles and always emits absolute URLs.
 */
export default createAction(
	routes.rss.articles,
	/**
	 * Builds an RSS 2.0 document for article listings.
	 *
	 * Articles scheduled in the future are filtered out through `Post.isPublishedAt`.
	 *
	 * @param ctx Request context with URL and dependency container access.
	 * @returns XML response with channel metadata and one item per published article.
	 */
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let articles = await ArticlePost.findAll(db, { includePreview: false });

		/**
		 * Channel `link` targets the human-readable articles index page.
		 */
		let rss = new RSS({
			title: "Articles — Sergio Xalambrí",
			description: "Articles by Sergio Xalambrí.",
			link: new URL(routes.articles.href(), ctx.url).toString(),
		});

		/**
		 * Adds one RSS item per published record.
		 *
		 * `published_at` can be `null` for immediately published posts, so item dates
		 * fall back to `created_at` to keep `pubDate` always populated.
		 */
		for (let article of articles) {
			/**
			 * Feed items use canonical public post URLs.
			 *
			 * Absolute URLs are required because many RSS readers resolve links outside
			 * the origin that served the XML document.
			 */
			let link = new URL(
				routes.post.href({ postType: "articles", postSlug: article.meta.slug }),
				ctx.url,
			).toString();
			rss.addItem({
				guid: article.id,
				title: article.meta.title,
				description: article.meta.excerpt ?? link,
				link,
				pubDate: new Date(article.published_at ?? article.created_at).toUTCString(),
			});
		}

		return xml(rss.toString());
	}),
);
