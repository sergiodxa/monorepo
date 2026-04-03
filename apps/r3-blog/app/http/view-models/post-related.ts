import type { Post } from "~/app/repositories/post";

import routes from "~/routes/web";

/**
 * Type contracts for the related-posts block rendered on a post page.
 */
export namespace PostRelatedViewModel {
	/**
	 * A single related post card shown in the list.
	 * `reason` is preformatted display text, not a raw tag value.
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
	 * Builds link-ready related items for rendering without additional formatting.
	 * This mapper currently links every related item through the tutorials route.
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
