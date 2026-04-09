import type { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";

/**
 * Feed-specific type contracts shared by repository consumers.
 */
export namespace Feed {
	/**
	 * One normalized entry in the combined public activity feed.
	 *
	 * `slug` is present for internal post routes, while `url` is present for external bookmarks.
	 */
	export interface ActivityItem {
		/** Logical content source used for rendering and routing decisions. */
		kind: "article" | "tutorial" | "bookmark" | "glossary";
		/** Human-readable title shown in feed UIs. */
		title: string;
		/** Internal slug used to build routes for article/tutorial/glossary entries. */
		slug?: string;
		/** External destination URL for bookmark entries. */
		url?: string;
		/** Canonical ISO-8601 activity date used by feed clients. */
		date: string;
		/** True when content is scheduled for the future and should be presented as preview. */
		preview: boolean;
	}
}

/**
 * Composes a single, time-ordered feed across public content repositories.
 */
export class Feed {
	/**
	 * Resolves the sort timestamp for activity records from mixed model shapes.
	 *
	 * Accepts both `snake_case` and `camelCase` date keys so the feed can normalize
	 * data from repositories with different serialization conventions.
	 *
	 * @param input Source object that may include published and created date fields.
	 * @returns Unix timestamp in milliseconds, derived from publish date when available.
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
	 * Determines whether a feed item should be flagged as preview content.
	 *
	 * This delegates publish-state semantics to `Post.isPublishedAt`, including the
	 * app rule that `published_at === null` is considered published (not preview).
	 *
	 * @param input Source object that may include a publish date field.
	 * @returns True only when the publish date exists and is in the future.
	 */
	static isPreview(input: unknown) {
		let record = input as { published_at?: string | null; publishedAt?: string | null };
		return !Post.isPublishedAt(record.published_at ?? record.publishedAt ?? null);
	}

	/**
	 * Builds the public activity feed from articles, tutorials, bookmarks, and glossary terms.
	 *
	 * Data is loaded in parallel, normalized to a shared shape, filtered to valid dates,
	 * sorted newest-first, and finally converted to ISO date strings for API/UI stability.
	 *
	 * @param db Database connection used to read post sources.
	 * @param limit Optional maximum number of items; non-positive values return an empty list.
	 * @returns Normalized feed items ordered from newest to oldest.
	 */
	static async listActivity(db: Database, limit?: number): Promise<Array<Feed.ActivityItem>> {
		if (typeof limit === "number" && limit <= 0) return [];

		let [articles, tutorials, bookmarks, glossary] = await Promise.all([
			ArticlePost.findAll(db, { includePreview: false }),
			TutorialPost.findAll(db, { includePreview: false }),
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
