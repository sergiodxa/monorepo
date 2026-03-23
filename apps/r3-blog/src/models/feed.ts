import type { Database } from "remix/data-table";

import { ArticlePost } from "~/models/posts/article";
import { GlossaryPost } from "~/models/posts/glossary";
import { LikePost } from "~/models/posts/like";
import { TutorialPost } from "~/models/posts/tutorial";

export namespace Feed {
	export interface ActivityItem {
		href: string;
		label: string;
		date: string;
		icon: string;
		icon_tint: "article" | "tutorial" | "bookmark" | "glossary";
		preview: boolean;
	}
}

export class Feed {
	static toTimestamp(value: unknown): number {
		if (value === null || value === undefined) return Number.NaN;

		if (typeof value === "number") {
			return Number.isFinite(value) ? value : Number.NaN;
		}

		if (value instanceof Date) {
			let time = value.getTime();
			return Number.isFinite(time) ? time : Number.NaN;
		}

		if (typeof value !== "string") return Number.NaN;

		let direct = Date.parse(value);
		if (Number.isFinite(direct)) return direct;

		let sqliteLike = value.replace(" ", "T");
		let asUtc = Date.parse(`${sqliteLike}Z`);
		if (Number.isFinite(asUtc)) return asUtc;

		return Number.NaN;
	}

	static async listActivity(db: Database, limit?: number): Promise<Array<Feed.ActivityItem>> {
		let now = Date.now();
		let [articles, tutorials, bookmarks, glossary] = await Promise.all([
			ArticlePost.listItems(db),
			TutorialPost.listItems(db),
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
				let href = `/articles/${article.slug}`;
				let publishedAt = article.published_at;
				let publishedAtTime = this.toTimestamp(publishedAt);
				let createdAtTime = this.toTimestamp(article.created_at);
				let isPublished =
					publishedAt === null || (Number.isFinite(publishedAtTime) && publishedAtTime <= now);

				return {
					href,
					label: `I wrote about ${article.title}`,
					date: Number.isFinite(publishedAtTime) ? publishedAtTime : createdAtTime,
					icon: "📝",
					icon_tint: "article" as const,
					preview: !isPublished,
				};
			}),
			...tutorials.map((tutorial) => {
				let href = `/tutorials/${tutorial.slug}`;
				let publishedAt = tutorial.published_at;
				let publishedAtTime = this.toTimestamp(publishedAt);
				let createdAtTime = this.toTimestamp(tutorial.created_at);
				let isPublished =
					publishedAt === null || (Number.isFinite(publishedAtTime) && publishedAtTime <= now);

				return {
					href,
					label: `I published how to ${tutorial.title}`,
					date: Number.isFinite(publishedAtTime) ? publishedAtTime : createdAtTime,
					icon: "🛠️",
					icon_tint: "tutorial" as const,
					preview: !isPublished,
				};
			}),
			...bookmarks.map((bookmark) => {
				let title = bookmark.meta.title;
				let publishedAt = bookmark.post.published_at;
				let publishedAtTime = this.toTimestamp(publishedAt);
				let createdAtTime = this.toTimestamp(bookmark.post.created_at);
				let isPublished =
					publishedAt === null || (Number.isFinite(publishedAtTime) && publishedAtTime <= now);

				return {
					href: LikePost.normalizeUrl(bookmark.meta.url),
					label: `I saved ${title}`,
					date: Number.isFinite(publishedAtTime) ? publishedAtTime : createdAtTime,
					icon: "🔖",
					icon_tint: "bookmark" as const,
					preview: !isPublished,
				};
			}),
			...glossary.map((entry) => {
				let href = `/glossary#${entry.meta.slug}`;
				let title = entry.meta.term;
				let publishedAt = entry.post.published_at;
				let publishedAtTime = this.toTimestamp(publishedAt);
				let createdAtTime = this.toTimestamp(entry.post.created_at);
				let isPublished =
					publishedAt === null || (Number.isFinite(publishedAtTime) && publishedAtTime <= now);

				return {
					href,
					label: `I added the definition of ${title}`,
					date: Number.isFinite(publishedAtTime) ? publishedAtTime : createdAtTime,
					icon: "📘",
					icon_tint: "glossary" as const,
					preview: !isPublished,
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
