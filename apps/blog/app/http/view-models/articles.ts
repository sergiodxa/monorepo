/**
 * View model for the articles index. Maps repository list records into
 * render-ready rows, building each `/articles/:slug` link from canonical route
 * definitions and deriving preview state from publish-date semantics. Repository
 * ordering is preserved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ArticlePost } from "~/app/repositories/posts/article";

import { Post } from "~/app/repositories/post";
import routes from "~/routes/web";

/**
 * Shape contracts for the articles index view: the exact data the template
 * expects once repository records become route-aware UI values.
 */
export namespace ArticlesViewModel {
	/**
	 * Render-ready values for one article row in the index list.
	 *
	 * Each field is already normalized, so templates render them directly.
	 */
	export interface Item {
		/**
		 * App-relative URL to the article details page.
		 *
		 * Built from canonical route definitions to keep links aligned with the
		 * `/articles/:slug` contract.
		 */
		href: string;
		label: string;
		/**
		 * Effective display date for the row.
		 *
		 * Prefers `published_at` and falls back to `created_at` so list pages can
		 * render a stable date even for immediately published content.
		 */
		date: string;
		/**
		 * Indicates whether the row should be visually marked as preview.
		 *
		 * `false` means publicly published, including `published_at === null`.
		 * `true` means publication is scheduled for a future date.
		 */
		preview: boolean;
	}

	/**
	 * Full payload consumed by the articles index template.
	 */
	export interface Page {
		/**
		 * Row models in the order the repository returned them.
		 */
		items: Array<Item>;
	}
}

/**
 * Builds article list view-model payloads for HTTP templates.
 */
export class ArticlesViewModel {
	/**
	 * Centralizes two contracts for the index route: route generation per slug,
	 * and preview detection based on `Post.isPublishedAt` semantics.
	 *
	 * @param articles Articles fetched for the index route.
	 * @returns Template-ready page payload with stable ordering.
	 */
	static index(articles: Array<ArticlePost.ListItem>): ArticlesViewModel.Page {
		let items = articles.map((article) => {
			let href = routes.post.href({ postType: "articles", postSlug: article.slug });
			let isPublished = Post.isPublishedAt(article.published_at);

			return {
				href,
				label: article.title,
				date: article.published_at ?? article.created_at,
				preview: !isPublished,
			};
		});

		return { items };
	}
}
