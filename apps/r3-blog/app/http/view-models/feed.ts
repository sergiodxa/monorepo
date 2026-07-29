/**
 * View model for the activity feed page. Maps repository feed records into render-ready
 * timeline rows, selecting per-kind copy, routes, and icon metadata for articles,
 * tutorials, bookmarks, and glossary entries, and dropping entries missing required
 * routing data. It centralizes feed presentation so controllers remain thin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColorValue } from "@pkg/u";

import type { Feed } from "~/app/repositories/feed";

import { LikePost } from "~/app/repositories/posts/like";
import routes from "~/routes/web";

/**
 * Type contracts consumed by the feed UI layer.
 *
 * These shapes are intentionally presentation-oriented and decoupled from
 * repository record details.
 */
export namespace FeedViewModel {
	/**
	 * Single feed timeline row ready to render without additional mapping.
	 *
	 * `href`, `label`, and `date` are preformatted so templates can stay mostly
	 * declarative.
	 */
	export interface ActivityItem {
		/** URL opened when the feed item is clicked. */
		href: string;
		/** Human-readable sentence describing the activity. */
		label: string;
		/** Activity date string ready for UI display. */
		date: string;
		/** Whether the activity points to preview-only content. */
		preview: boolean;
		/** Emoji icon representing the activity type. */
		icon: string;
		/**
		 * Semantic tone the icon is tinted with, named in the design system's own
		 * vocabulary (`"brand.emphasis"`, `"neutral"`, ...) rather than as a raw
		 * CSS color. The view resolves it through the color utilities, so this
		 * stays a presentation *choice* the view model owns while the actual
		 * value stays the theme's to decide.
		 */
		iconTint: ColorValue;
	}

	/**
	 * Feed page payload expected by the HTTP template.
	 *
	 * Items are already ordered by the repository and preserved as-is.
	 */
	export interface Page {
		/** Ordered list of activity rows to render. */
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
	 * Builds the feed payload consumed by the feed page template.
	 *
	 * The mapper enforces URL requirements per kind and drops incomplete entries
	 * (`slug`/`url` missing) to avoid rendering broken links.
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
	 * Type guard used after mapping to remove invalid placeholder rows.
	 *
	 * `index` emits `null` when required routing data is missing; this method
	 * narrows the array back to strictly renderable entries.
	 *
	 * @param item Potential mapped activity row.
	 * @returns `true` when the value is a renderable activity item.
	 */
	static isActivityItem(
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
