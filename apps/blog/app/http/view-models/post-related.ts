/**
 * View model for the related-posts block shown on a post page. Transforms repository
 * related-post rows into link-ready cards, building each href through the tutorials
 * route and formatting a human-readable reason from the matched tag. It exists to keep
 * related-post presentation out of controllers while preserving repository ranking.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Post } from "~/app/repositories/post";

import routes from "~/routes/web";

/**
 * Type contracts for the related-posts block rendered on a post page.
 */
export namespace PostRelatedViewModel {
	/**
	 * A single related post card shown in the list. `reason` holds preformatted
	 * display text ready to render.
	 */
	export interface Item {
		href: string;
		label: string;
		reason: string;
	}

	/**
	 * Full payload consumed by the related-posts section.
	 * `items` preserves the ranking/order from the repository query.
	 */
	export interface Page {
		items: Array<Item>;
	}
}

/**
 * Transforms repository related-post rows into UI text and links.
 */
export class PostRelatedViewModel {
	/**
	 * Builds related items that render as-is, linked through the tutorials route.
	 * @param items Related posts already filtered and ordered by tag matching.
	 * @returns A page payload; returns an empty `items` array when no matches exist.
	 */
	static index(items: Array<Post.RelatedByTypeItem>): PostRelatedViewModel.Page {
		return {
			items: items.map((item) => ({
				href: routes.post.href({ postType: "tutorials", postSlug: item.slug }),
				label: item.title,
				reason: `Because both uses ${item.matchedTag}`,
			})),
		};
	}
}
