/**
 * View model for the activity feed page. Maps repository feed records into render-ready
 * timeline rows, selecting per-kind copy, routes, and icon metadata for articles,
 * tutorials, bookmarks, and glossary entries, and dropping entries missing required
 * routing data. It centralizes feed presentation so controllers remain thin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColorValue } from "@sdxc/u";

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
		/** Emoji icon standing in for the activity type. */
		icon: string;
		/**
		 * Semantic tone the icon is tinted with, named in the design system's own
		 * vocabulary (`"brand.emphasis"`, `"neutral"`, ...). The view resolves it
		 * through the color utilities, so the theme owns the resulting color.
		 */
		iconTint: ColorValue;
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
 * This class centralizes copy, route selection, and icon metadata per feed
 * kind so controllers stay thin.
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
			.map((item) => {
				if (item.kind === "article") {
					if (!item.slug) return null;

					return {
						href: routes.post.href({ postType: "articles", postSlug: item.slug }),
						label: `I wrote about ${item.title}`,
						date: item.date,
						preview: item.preview,
						icon: "📝",
						iconTint: "brand.emphasis",
					};
				}

				if (item.kind === "tutorial") {
					if (!item.slug) return null;

					return {
						href: routes.post.href({ postType: "tutorials", postSlug: item.slug }),
						label: `I published how to ${item.title}`,
						date: item.date,
						preview: item.preview,
						icon: "🛠️",
						iconTint: "brand",
					};
				}

				if (item.kind === "bookmark") {
					if (!item.url) return null;

					return {
						href: LikePost.normalizeUrl(item.url),
						label: `I saved ${item.title}`,
						date: item.date,
						preview: item.preview,
						icon: "🔖",
						iconTint: "neutral.emphasis",
					};
				}

				if (!item.slug) return null;

				return {
					href: `${routes.glossary.href()}#${item.slug}`,
					label: `I added the definition of ${item.title}`,
					date: item.date,
					preview: item.preview,
					icon: "📘",
					iconTint: "neutral",
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
		item: {
			href: string;
			label: string;
			date: string;
			preview: boolean;
			icon: string;
			iconTint: string;
		} | null,
	): item is FeedViewModel.ActivityItem {
		return item !== null;
	}
}
