/**
 * The blog's activity feed model. Composes a single time-ordered public activity
 * feed by loading articles, tutorials, notes, TILs, bookmarks, and glossary entries
 * in parallel, normalizing them to a shared item shape, and sorting newest-first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BlogModels } from "~/app/models";
import type { Kind } from "~/app/models/kinds";

import {
	bookmarkLabel,
	isPublishedAt,
	timestampFromPublishedOrCreated,
} from "~/app/models/post-values";

/**
 * Feed-specific type contracts shared by repository consumers.
 */
export namespace Feed {
	/**
	 * One normalized entry in the combined public activity feed.
	 *
	 * `slug` is present for internal post routes, while `url` is present for
	 * external bookmarks.
	 */
	export interface ActivityItem {
		kind: Kind;
		/** A bookmark without a title is named by its address, as `/bookmarks` names it. */
		title: string;
		slug?: string;
		url?: string;
		/** A note's or TIL's Markdown, which the index shows in place; other kinds carry none. */
		content?: string;
		/** Activity date in ISO-8601 format. */
		date: string;
		/** True when the publish date is in the future. */
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

		return timestampFromPublishedOrCreated({
			published_at: record.published_at ?? record.publishedAt ?? null,
			created_at: record.created_at ?? record.createdAt ?? "",
		});
	}

	/**
	 * Determines whether a feed item should be flagged as preview content.
	 *
	 * Publish-state semantics come from `isPublishedAt`, where a null
	 * `published_at` counts as published.
	 *
	 * @param input Source object that may include a publish date field.
	 * @returns True only when the publish date exists and is in the future.
	 */
	static isPreview(input: unknown) {
		let record = input as { published_at?: string | null; publishedAt?: string | null };
		return !isPublishedAt(record.published_at ?? record.publishedAt ?? null);
	}

	/**
	 * Builds the public activity feed from articles, tutorials, notes, TILs,
	 * bookmarks, and glossary terms. Items whose date cannot be parsed are dropped, and dates are
	 * emitted as ISO strings for API and UI stability.
	 *
	 * @param models The invocation's models, read for every post type.
	 * @param limit Optional maximum number of items; non-positive values return an empty list.
	 * @returns Normalized feed items ordered from newest to oldest.
	 */
	static async listActivity(models: BlogModels, limit?: number): Promise<Array<Feed.ActivityItem>> {
		if (typeof limit === "number" && limit <= 0) return [];

		let [articles, tutorials, bookmarks, glossary, notes, tils, releases] = await Promise.all([
			models.articles.findAll({ includePreview: false }),
			models.tutorials.findAll({ includePreview: false }),
			models.likes.findAll(),
			models.glossary.findAll(),
			models.notes.findAll({ includePreview: false }),
			models.tils.findAll({ includePreview: false }),
			models.releases.findAll({ includePreview: false }),
		]);

		let rawActivity: Array<{
			kind: Feed.ActivityItem["kind"];
			title: string;
			slug?: string;
			url?: string;
			content?: string;
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
					title: bookmarkLabel(bookmark.meta),
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
			...notes.map((note) => ({
				kind: "note" as const,
				title: "",
				slug: note.meta.slug,
				content: note.meta.content,
				date: this.activityTimestamp(note),
				preview: this.isPreview(note),
			})),
			...tils.map((til) => ({
				kind: "til" as const,
				title: til.meta.title,
				slug: til.meta.slug,
				content: til.meta.content,
				date: this.activityTimestamp(til),
				preview: this.isPreview(til),
			})),
			...releases.map((release) => ({
				kind: "release" as const,
				title: release.meta.title,
				slug: release.meta.slug,
				date: this.activityTimestamp(release),
				preview: this.isPreview(release),
			})),
		]
			.filter((item) => Number.isFinite(item.date))
			.sort((a, b) => b.date - a.date)
			.slice(0, typeof limit === "number" ? limit : Number.MAX_SAFE_INTEGER);

		let activity: Array<Feed.ActivityItem> = rawActivity.map((item) => ({
			kind: item.kind,
			title: item.title,
			slug: item.slug,
			url: item.url,
			content: item.content,
			date: new Date(item.date).toISOString(),
			preview: item.preview,
		}));

		return activity;
	}
}
