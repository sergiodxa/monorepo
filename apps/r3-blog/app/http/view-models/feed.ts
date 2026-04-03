import type { Feed } from "~/app/repositories/feed";

import { LikePost } from "~/app/repositories/posts/like";
import routes from "~/routes/web";

export namespace FeedViewModel {
	export interface ActivityItem {
		href: string;
		label: string;
		date: string;
		preview: boolean;
		icon: string;
		iconTint: string;
	}

	export interface Page {
		activity: Array<ActivityItem>;
	}
}

export class FeedViewModel {
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
						iconTint: "var(--ui-accent-fg-emphasis)",
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
						iconTint: "var(--ui-accent-fg)",
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
						iconTint: "var(--ui-neutral-fg-emphasis)",
					};
				}

				if (!item.slug) return null;

				return {
					href: `${routes.glossary.href()}#${item.slug}`,
					label: `I added the definition of ${item.title}`,
					date: item.date,
					preview: item.preview,
					icon: "📘",
					iconTint: "var(--ui-neutral-fg)",
				};
			})
			.filter(this.isActivityItem);

		return { activity: items };
	}

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
