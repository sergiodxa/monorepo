import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { RSS } from "@pkg/rss";
import { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import routes from "~/routes/web";

/**
 * Serves the public RSS XML feed for the blog domain.
 *
 * The feed merges multiple content streams into one timeline and omits preview-only posts.
 */
export default action<typeof routes.rss.feed>(
	/**
	 * Fetches all RSS-eligible entities, normalizes them into `RSS.Item` records, and serializes XML.
	 *
	 * Articles and tutorials respect `Post.isPublishedAt` so future-dated items stay out of the feed.
	 * @param ctx Request-scoped action context with dependency injection and canonical request URL.
	 * @returns XML response containing one reverse-chronological RSS feed across all content types.
	 */
	async (ctx) => {
		let database = ctx.get(Database);

		let [articles, tutorials, likes, glossary] = await Promise.all([
			ArticlePost.findAll(database),
			TutorialPost.findAll(database),
			LikePost.findAll(database),
			GlossaryPost.findAll(database),
		]);

		let rss = new RSS({
			title: "Sergio Xalambrí",
			description: "Articles, tutorials, bookmarks, and glossary terms by Sergio Xalambrí.",
			link: ctx.url.origin,
		});

		/**
		 * Collects normalized feed entries before global sorting and RSS serialization.
		 */
		let items: Array<RSS.Item> = [];

		for (let article of articles) {
			if (!Post.isPublishedAt(article.published_at)) continue;
			let link = new URL(
				routes.post.href({ postType: "articles", postSlug: article.meta.slug }),
				ctx.url,
			).toString();
			items.push({
				guid: article.id,
				title: article.meta.title,
				description: article.meta.excerpt ?? link,
				link,
				pubDate: new Date(article.published_at ?? article.created_at).toUTCString(),
			});
		}

		for (let tutorial of tutorials) {
			if (!Post.isPublishedAt(tutorial.published_at)) continue;
			let link = new URL(
				routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug }),
				ctx.url,
			).toString();
			items.push({
				guid: tutorial.id,
				title: tutorial.meta.title,
				description: tutorial.meta.excerpt ?? link,
				link,
				pubDate: new Date(tutorial.published_at ?? tutorial.created_at).toUTCString(),
			});
		}

		for (let like of likes) {
			items.push({
				guid: like.id,
				title: like.meta.title,
				description: like.meta.url,
				link: like.meta.url,
				pubDate: new Date(like.created_at).toUTCString(),
			});
		}

		for (let term of glossary) {
			let link = new URL(`${routes.glossary.href()}#${term.meta.slug}`, ctx.url).toString();
			let title = term.meta.title ? `${term.meta.term} (aka ${term.meta.title})` : term.meta.term;
			items.push({
				guid: term.id,
				title,
				description: term.meta.definition,
				link,
				pubDate: new Date(term.created_at).toUTCString(),
			});
		}

		items.sort(
			/**
			 * Orders items by publication date descending (newest first).
			 *
			 * `pubDate` values are generated with `toUTCString()`, so `Date.parse` can compare them safely.
			 * @param a Left item in the comparison.
			 * @param b Right item in the comparison.
			 * @returns Negative when `b` is newer than `a`; positive when `a` is newer than `b`.
			 */
			(a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate),
		);

		for (let item of items) rss.addItem(item);

		return xml(rss.toString());
	},
);
