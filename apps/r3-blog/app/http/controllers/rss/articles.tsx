import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { RSS } from "@pkg/rss";
import { Database } from "remix/data-table";

import { ArticlePost } from "~/app/repositories/posts/article";
import routes from "~/routes/web";

/**
 * Serves the articles RSS feed consumed by feed readers and crawlers.
 *
 * The payload includes only public articles and always emits absolute URLs.
 */
export default action<typeof routes.rss.articles>(
	/**
	 * Builds an RSS 2.0 document for article listings.
	 *
	 * Articles scheduled in the future are filtered out through `Post.isPublishedAt`.
	 *
	 * @param ctx Request context with URL and dependency container access.
	 * @returns XML response with channel metadata and one item per published article.
	 */
	async (ctx) => {
		let articles = await ArticlePost.findAll(ctx.get(Database), { includePreview: false });

		/**
		 * Channel metadata used by clients to identify this feed.
		 *
		 * `link` points to the human-readable articles index, not to a single post.
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
	},
);
