/**
 * View model for the tutorials index. Maps tutorial repository list records into
 * render-ready rows, building each `/tutorials/:slug` link from canonical routes and
 * deriving preview state from publish-date semantics. It exists to keep tutorial
 * listing controllers thin; it only maps and annotates records without sorting or filtering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TutorialPost } from "~/app/repositories/posts/tutorial";

import { Post } from "~/app/repositories/post";
import routes from "~/routes/web";

/**
 * Shared contracts consumed by the tutorials index controller and UI.
 *
 * These shapes represent already-fetched tutorial records mapped for rendering.
 */
export namespace TutorialsViewModel {
	/**
	 * One tutorial row ready to render in the listing.
	 */
	export interface Item {
		/** Absolute app route to `/tutorials/:slug` for this tutorial. */
		href: string;
		/** Human-readable tutorial title displayed as the list label. */
		label: string;
		/**
		 * Effective display date for this tutorial row.
		 *
		 * Prefers `published_at` and falls back to `created_at` so the listing always
		 * has a date to render.
		 */
		date: string;
		/**
		 * Whether this tutorial should be marked as preview content.
		 *
		 * `false` includes both explicitly published posts and `published_at === null`.
		 */
		preview: boolean;
	}

	/**
	 * Data required to render the tutorials index page.
	 */
	export interface Page {
		/** Tutorials in the same order they were provided by the caller. */
		items: Array<Item>;
	}
}

/**
 * Builds tutorials page view models from repository list items.
 *
 * This class only maps and annotates records; it does not sort or filter them.
 */
export class TutorialsViewModel {
	/**
	 * Maps tutorial records into route-aware listing data.
	 *
	 * Each input row becomes one output item, preserving input order.
	 * Preview state is derived from `Post.isPublishedAt`, so future dates are preview,
	 * while `null` is treated as published.
	 *
	 * @param tutorials Tutorial rows returned by the tutorials repository.
	 * @returns Page payload ready for the tutorials index template.
	 */
	static index(tutorials: Array<TutorialPost.ListItem>): TutorialsViewModel.Page {
		let items = tutorials.map((tutorial) => {
			let href = routes.post.href({ postType: "tutorials", postSlug: tutorial.slug });
			let isPublished = Post.isPublishedAt(tutorial.published_at);

			return {
				href,
				label: tutorial.title,
				date: tutorial.published_at ?? tutorial.created_at,
				preview: !isPublished,
			};
		});

		return { items };
	}
}
