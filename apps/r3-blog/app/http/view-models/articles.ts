import type { ArticlePost } from "~/app/repositories/posts/article";

import { Post } from "~/app/repositories/post";
import routes from "~/routes/web";

/**
 * Shape contracts for the articles index view.
 *
 * These types represent the exact data expected by the articles template,
 * after repository records are converted into route-aware UI values.
 */
export namespace ArticlesViewModel {
	/**
	 * Render-ready values for one article row in the index list.
	 *
	 * Each field is already normalized for presentation, so templates can render
	 * without additional routing or publish-state logic.
	 */
	export interface Item {
		/**
		 * App-relative URL to the article details page.
		 *
		 * Built from canonical route definitions to keep links aligned with the
		 * `/articles/:slug` contract.
		 */
		href: string;
		/**
		 * Human-readable article title shown as the list label.
		 */
		label: string;
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
		 * Ordered row models rendered by the articles page.
		 *
		 * Order is preserved from the repository result; this view-model does not
		 * sort, filter, or paginate the incoming collection.
		 */
		items: Array<Item>;
	}
}

/**
 * Builds article list view-model payloads for HTTP templates.
 */
export class ArticlesViewModel {
	/**
	 * Converts repository list records into `ArticlesViewModel.Page`.
	 *
	 * The mapper centralizes two contracts: route generation for each slug and
	 * preview detection based on `Post.isPublishedAt` publish-state semantics.
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
				preview: !isPublished,
			};
		});

		return { items };
	}
}
