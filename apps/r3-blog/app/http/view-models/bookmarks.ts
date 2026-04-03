import { LikePost as LikePostRepository } from "~/app/repositories/posts/like";

export namespace BookmarksViewModel {
	export interface Item {
		href: string;
		label: string;
		preview: boolean;
		suffixHref?: string;
		suffixLabel?: string;
		suffixAriaLabel?: string;
		suffixTitle?: string;
	}

	export interface Page {
		items: Array<Item>;
	}
}

export class BookmarksViewModel {
	static index(
		bookmarks: Array<Awaited<ReturnType<typeof LikePostRepository.findAll>>[number]>,
	): BookmarksViewModel.Page {
		let items = [...bookmarks]
			.sort((a, b) => this.activityTimestamp(b) - this.activityTimestamp(a))
			.map((bookmark) => {
				let href = bookmark.meta.url;
				let label = bookmark.meta.title;
				let normalizedHref = LikePostRepository.normalizeUrl(href);
				let publishedAt = this.publishedAt(bookmark);
				let isPublished = publishedAt === null || Date.parse(publishedAt) <= Date.now();
				let createdAt = this.createdAt(bookmark);
				let suffixHref = normalizedHref.startsWith("http")
					? LikePostRepository.waybackSnapshotUrl(normalizedHref, createdAt)
					: null;

				return {
					href,
					label,
					preview: !isPublished,
					suffixHref: suffixHref ?? undefined,
					suffixLabel: suffixHref ? "🏛️" : undefined,
					suffixAriaLabel: suffixHref ? "View on Wayback Machine" : undefined,
					suffixTitle: suffixHref ? "Wayback Machine" : undefined,
				};
			});

		return { items };
	}

	private static publishedAt(input: unknown): string | null {
		let record = input as { published_at?: string | null; publishedAt?: string | null };
		return record.published_at ?? record.publishedAt ?? null;
	}

	private static createdAt(input: unknown): string {
		let record = input as { created_at?: string; createdAt?: string };
		return record.created_at ?? record.createdAt ?? "";
	}

	private static activityTimestamp(input: unknown): number {
		let publishedAt = this.publishedAt(input);
		let createdAt = this.createdAt(input);
		let value = publishedAt ?? createdAt;
		let timestamp = Date.parse(value);
		return Number.isFinite(timestamp) ? timestamp : Number.NaN;
	}
}
