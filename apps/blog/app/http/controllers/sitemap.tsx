/**
 * HTTP action for the XML sitemap. It combines static section URLs (feed, articles,
 * tutorials, bookmarks, glossary) with individual published articles and tutorials,
 * deriving `lastmod` hints from the freshest creation date per section. It exists to give
 * crawlers a canonical, discoverable index of the site's public pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { Sitemap } from "@pkg/sitemap";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { ArticlePost } from "~/app/repositories/posts/article";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import routes from "~/routes/web";

/**
 * Serves the XML sitemap consumed by crawlers for discoverable public pages.
 *
 * The payload mixes section-level URLs and individual published posts, and sets
 * `lastmod` hints using the freshest known creation date per section.
 */
export default createAction(
	routes.sitemap,
	/**
	 * Builds a canonical sitemap from static sections plus published articles/tutorials.
	 *
	 * It assumes repository `findAll` methods return newest-first rows, so using
	 * `.at(0)` yields the latest timestamp for each listing page.
	 *
	 * @param ctx - Request context with database access and base URL.
	 * @returns XML response ready for `/sitemap.xml` style endpoints.
	 */
	inject([Database] as const, async function sitemapAction(database) {
		let ctx = getContext();
		let [articles, tutorials, likes] = await Promise.all([
			ArticlePost.findAll(database, { includePreview: false }),
			TutorialPost.findAll(database, { includePreview: false }),
			LikePost.findAll(database),
		]);

		let sitemap = new Sitemap();

		let lastArticleDate = articles.at(0)?.created_at;
		let lastTutorialDate = tutorials.at(0)?.created_at;
		let lastBookmarkDate = likes.at(0)?.created_at;

		let dates = [lastArticleDate, lastTutorialDate, lastBookmarkDate]
			/**
			 * Removes missing section dates before numeric comparison.
			 */
			.filter(Boolean)
			/**
			 * Converts date-like values to epoch milliseconds for `Math.max`.
			 *
			 * @param d - Persisted timestamp from repository records.
			 * @returns Milliseconds since Unix epoch.
			 */
			.map((d) => new Date(d).getTime());

		let lastPostDate = dates.length > 0 ? new Date(Math.max(...dates)) : undefined;

		sitemap.append(new URL(routes.feed.href(), ctx.url), { updatedAt: lastPostDate });

		sitemap.append(new URL(routes.articles.href(), ctx.url), {
			updatedAt: lastArticleDate ? new Date(lastArticleDate) : undefined,
		});

		sitemap.append(new URL(routes.tutorials.href(), ctx.url), {
			updatedAt: lastTutorialDate ? new Date(lastTutorialDate) : undefined,
		});

		sitemap.append(new URL(routes.bookmarks.href(), ctx.url), {
			updatedAt: lastBookmarkDate ? new Date(lastBookmarkDate) : undefined,
		});

		sitemap.append(new URL(routes.glossary.href(), ctx.url));

		for (let article of articles) {
			sitemap.append(
				new URL(routes.post.href({ postType: "articles", postSlug: article.meta.slug }), ctx.url),
				{
					updatedAt: new Date(article.created_at),
				},
			);
		}

		for (let tutorial of tutorials) {
			sitemap.append(
				new URL(routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug }), ctx.url),
				{
					updatedAt: new Date(tutorial.created_at),
				},
			);
		}

		return xml(sitemap.toString());
	}),
);
