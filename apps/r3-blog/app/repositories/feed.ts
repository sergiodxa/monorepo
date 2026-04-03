import type { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";

export namespace Feed {
	/**
	 * A single activity entry displayed in the combined public feed.
	 */
	export interface ActivityItem {
		kind: "article" | "tutorial" | "bookmark" | "glossary";
		title: string;
		slug?: string;
		url?: string;
		date: string;
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
	static activityTimestamp(input: unknown) {
		let record = input as {
			published_at?: string | null;
			created_at?: string;
			publishedAt?: string | null;
			createdAt?: string;
		};

		return Post.timestampFromPublishedOrCreated({
			published_at: record.published_at ?? record.publishedAt ?? null,
			created_at: record.created_at ?? record.createdAt ?? "",
		});
	}

	/**
	 * Shared preview-state helper for feed activities.
	 */
	static isPreview(input: unknown) {
		let record = input as { published_at?: string | null; publishedAt?: string | null };
		return !Post.isPublishedAt(record.published_at ?? record.publishedAt ?? null);
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
			kind: Feed.ActivityItem["kind"];
			title: string;
			slug?: string;
			url?: string;
			date: number;
			preview: boolean;
		}> = [
			...articles.map((article) => {
				let activityDate = this.activityTimestamp(article);

				return {
					kind: "article" as const,
					title: article.meta.title,
					slug: article.meta.slug,
					date: activityDate,
					preview: this.isPreview(article),
				};
			}),
			...tutorials.map((tutorial) => {
				let activityDate = this.activityTimestamp(tutorial);

				return {
					kind: "tutorial" as const,
					title: tutorial.meta.title,
					slug: tutorial.meta.slug,
					date: activityDate,
					preview: this.isPreview(tutorial),
				};
			}),
			...bookmarks.map((bookmark) => {
				let activityDate = this.activityTimestamp(bookmark);

				return {
					kind: "bookmark" as const,
					title: bookmark.meta.title,
					url: bookmark.meta.url,
					date: activityDate,
					preview: this.isPreview(bookmark),
				};
			}),
			...glossary.map((entry) => {
				let activityDate = this.activityTimestamp(entry);

				return {
					kind: "glossary" as const,
					title: entry.meta.term,
					slug: entry.meta.slug,
					date: activityDate,
					preview: this.isPreview(entry),
				};
			}),
		]
			.filter((item) => Number.isFinite(item.date))
			.sort((a, b) => b.date - a.date)
			.slice(0, typeof limit === "number" ? limit : Number.MAX_SAFE_INTEGER);

		let activity: Array<Feed.ActivityItem> = rawActivity.map((item) => ({
			kind: item.kind,
			title: item.title,
			slug: item.slug,
			url: item.url,
			date: new Date(item.date).toISOString(),
			preview: item.preview,
		}));

		return activity;
	}
}
