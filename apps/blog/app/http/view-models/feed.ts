/**
 * View model for the activity feed page. Maps repository feed records into render-ready
 * timeline rows, selecting per-kind copy and routes for articles,
 * tutorials, bookmarks, and glossary entries, and dropping entries missing required
 * routing data. It centralizes feed presentation so controllers remain thin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Feed } from "~/app/repositories/feed";

import { LikePost } from "~/app/repositories/posts/like";
import routes from "~/routes/web";

/**
 * Type contracts consumed by the feed UI layer: presentation-oriented shapes
 * that stand on their own once repository records are mapped.
 */
export namespace FeedViewModel {
	/**
	 * Single feed timeline row. `href`, `label`, and `date` arrive preformatted
	 * so templates stay declarative.
	 */
	export interface ActivityItem {
		href: string;
		/** Full sentence describing the activity, written in first person. */
		label: string;
		date: string;
		/** Whether the activity points to preview-only content. */
		preview: boolean;
		/**
		 * What the activity is, which picks the row's emoji. A `bookmark`'s `href` is someone
		 * else's page the author saved, marked up as the entry's `bookmark-of`.
		 */
		kind: "article" | "tutorial" | "bookmark" | "glossary";
	}

	/**
	 * Feed page payload expected by the HTTP template.
	 *
	 * Items are already ordered by the repository and preserved as-is.
	 */
	export interface Page {
		activity: Array<ActivityItem>;
	}
}

/**
 * Maps repository feed records into feed-page presentation data.
 *
 * This class centralizes copy and route selection per feed kind so controllers
 * stay thin.
 */
export class FeedViewModel {
	/**
	 * Enforces the URL requirements of each kind: entries missing their `slug` or
	 * `url` are dropped so every rendered row links somewhere valid.
	 *
	 * @param activity Feed items from the data layer.
	 * @returns Render-safe feed payload with timeline metadata per activity kind.
	 */
	static index(activity: Array<Feed.ActivityItem>): FeedViewModel.Page {
		let items = activity
			.map((item): FeedViewModel.ActivityItem | null => {
				if (item.kind === "article") {
					if (!item.slug) return null;

					return {
						href: routes.post.href({ postType: "articles", postSlug: item.slug }),
						label: `I wrote about ${item.title}`,
						date: item.date,
						preview: item.preview,
						kind: "article",
					};
				}

				if (item.kind === "tutorial") {
					if (!item.slug) return null;

					return {
						href: routes.post.href({ postType: "tutorials", postSlug: item.slug }),
						label: `I published how to ${item.title}`,
						date: item.date,
						preview: item.preview,
						kind: "tutorial",
					};
				}

				if (item.kind === "bookmark") {
					if (!item.url) return null;

					return {
						href: LikePost.normalizeUrl(item.url),
						label: `I saved ${item.title}`,
						date: item.date,
						preview: item.preview,
						kind: "bookmark",
					};
				}

				if (!item.slug) return null;

				return {
					href: `${routes.glossary.href()}#${item.slug}`,
					label: `I added the definition of ${item.title}`,
					date: item.date,
					preview: item.preview,
					kind: "glossary",
				};
			})
			.filter(this.isActivityItem);

		return { activity: items };
	}

	/**
	 * `index` emits `null` when required routing data is missing; this narrows
	 * the mapped array back to strictly renderable entries.
	 *
	 * @param item Potential mapped activity row.
	 * @returns `true` when the value is a renderable activity item.
	 */
	static isActivityItem(
		this: void,
		item: FeedViewModel.ActivityItem | null,
	): item is FeedViewModel.ActivityItem {
		return item !== null;
	}
}
