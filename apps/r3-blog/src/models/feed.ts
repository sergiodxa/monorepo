import type { Database } from "remix/data-table";

import { Location } from "@pkg/location";

import { Post } from "~/models/post";
import { ArticlePost } from "~/models/posts/article";
import { GlossaryPost } from "~/models/posts/glossary";
import { LikePost } from "~/models/posts/like";
import { TutorialPost } from "~/models/posts/tutorial";
import routes from "~/routes";

export namespace Feed {
	/**
	 * A single activity entry displayed in the combined public feed.
	 */
	export interface ActivityItem {
		href: string;
		label: string;
		date: string;
		icon: string;
		icon_tint: "article" | "tutorial" | "bookmark" | "glossary";
		preview: boolean;
	}
}

/**
 * Feed model that aggregates activity from multiple post types.
 */
export class Feed {
	/**
	 * Shared date ordering helper for feed activities.
	 */
	static activityTimestamp(input: { published_at: string | null; created_at: string }) {
		return Post.timestampFromPublishedOrCreated(input);
	}

	/**
	 * Shared preview-state helper for feed activities.
	 */
	static isPreview(published_at: string | null) {
		return !Post.isPublishedAt(published_at);
	}

	/**
	 * Lists merged activity entries ordered by date descending.
	 * Combines articles, tutorials, bookmarks, and glossary entries.
	 */
	static async listActivity(db: Database, limit?: number): Promise<Array<Feed.ActivityItem>> {
		if (typeof limit === "number" && limit <= 0) return [];

		let [articles, tutorials, bookmarks, glossary] = await Promise.all([
			ArticlePost.findAll(db),
			TutorialPost.findAll(db),
			LikePost.findAll(db),
			GlossaryPost.findAll(db),
		]);

		let rawActivity: Array<{
			href: string;
			label: string;
			date: number;
			icon: string;
			icon_tint: Feed.ActivityItem["icon_tint"];
			preview: boolean;
		}> = [
			...articles.map((article) => {
				let href = routes.post.href({ postType: "articles", postSlug: article.meta.slug });
				let activityDate = this.activityTimestamp(article);

				return {
					href,
					label: `I wrote about ${article.meta.title}`,
					date: activityDate,
					icon: "📝",
					icon_tint: "article" as const,
					preview: this.isPreview(article.published_at),
				};
			}),
			...tutorials.map((tutorial) => {
				let href = routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug });
				let activityDate = this.activityTimestamp(tutorial);

				return {
					href,
					label: `I published how to ${tutorial.meta.title}`,
					date: activityDate,
					icon: "🛠️",
					icon_tint: "tutorial" as const,
					preview: this.isPreview(tutorial.published_at),
				};
			}),
			...bookmarks.map((bookmark) => {
				let activityDate = this.activityTimestamp(bookmark);

				return {
					href: LikePost.normalizeUrl(bookmark.meta.url),
					label: `I saved ${bookmark.meta.title}`,
					date: activityDate,
					icon: "🔖",
					icon_tint: "bookmark" as const,
					preview: this.isPreview(bookmark.published_at),
				};
			}),
			...glossary.map((entry) => {
				let activityDate = this.activityTimestamp(entry);
				let href = new Location({
					pathname: routes.glossary.href(),
					hash: entry.meta.slug,
				}).toString();

				return {
					href,
					label: `I added the definition of ${entry.meta.term}`,
					date: activityDate,
					icon: "📘",
					icon_tint: "glossary" as const,
					preview: this.isPreview(entry.published_at),
				};
			}),
		]
			.filter((item) => Number.isFinite(item.date))
			.sort((a, b) => b.date - a.date)
			.slice(0, typeof limit === "number" ? limit : Number.MAX_SAFE_INTEGER);

		let activity: Array<Feed.ActivityItem> = rawActivity.map((item) => ({
			href: item.href,
			label: item.label,
			date: new Date(item.date).toISOString(),
			icon: item.icon,
			icon_tint: item.icon_tint,
			preview: item.preview,
		}));

		return activity;
	}
}
