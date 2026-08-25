/**
 * HTTP action for the XML sitemap. It combines section URLs with published articles and
 * tutorials, deriving `lastmod` hints from the freshest creation date per section, so
 * crawlers get a canonical index of the site's public pages.
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

/** Serves the XML sitemap covering the section pages and every published post. */
export default createAction(
	routes.sitemap,
	/**
	 * Repository `findAll` results arrive newest-first, so `.at(0)` holds the latest
	 * timestamp for each listing page.
	 * @returns XML response for the sitemap endpoint.
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
			.filter(Boolean)
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
