/**
 * View model for the bookmarks page. Normalizes liked-post records into render-ready
 * rows, ordering them by activity time (publish date, else creation date) and deriving
 * preview state plus optional Wayback Machine archive metadata for absolute HTTP URLs.
 * It centralizes bookmark presentation logic so controllers only pass through raw data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LikePost as LikePostRepository } from "~/app/repositories/posts/like";

/**
 * Contracts consumed by the bookmarks page template.
 */
export namespace BookmarksViewModel {
	/**
	 * Render-ready bookmark row shown in the public list.
	 *
	 * Suffix properties are optional and are emitted as a group when an archive URL
	 * can be generated for the bookmark.
	 */
	export interface Item {
		/**
		 * Original bookmark URL used by the primary anchor.
		 */
		href: string;
		/**
		 * Human-readable title rendered as link text.
		 */
		label: string;
		/**
		 * Effective display date for the bookmark row.
		 *
		 * Uses publish time when present so scheduled items sort and display by their
		 * intended publish date, otherwise falls back to creation time.
		 */
		date: string;
		/**
		 * Whether the item should be marked as preview.
		 *
		 * `false` includes explicitly published records and records with no publish date.
		 */
		preview: boolean;
		/**
		 * Archive snapshot URL for the trailing metadata action.
		 */
		suffixHref?: string;
		/**
		 * Compact label rendered for the archive metadata action.
		 */
		suffixLabel?: string;
		/**
		 * Accessible name for the archive metadata action.
		 */
		suffixAriaLabel?: string;
		/**
		 * Tooltip text for the archive metadata action.
		 */
		suffixTitle?: string;
	}

	/**
	 * Page payload consumed by the bookmarks template renderer.
	 */
	export interface Page {
		/**
		 * Bookmarks sorted by most recent activity first.
		 */
		items: Array<Item>;
	}
}

/**
 * Builds render-ready bookmarks page data from repository records.
 */
export class BookmarksViewModel {
	/**
	 * Normalizes bookmark metadata and derives display-only fields.
	 *
	 * The result is ordered by activity time (published date when available, otherwise
	 * creation date). Wayback metadata is only attached for absolute HTTP(S) URLs.
	 * @param bookmarks Raw liked-post records returned by the bookmarks repository.
	 * @returns Bookmarks page payload sorted by most recent activity first.
	 */
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
					date: publishedAt ?? createdAt,
					preview: !isPublished,
					suffixHref: suffixHref ?? undefined,
					suffixLabel: suffixHref ? "🏛️" : undefined,
					suffixAriaLabel: suffixHref ? "View on Wayback Machine" : undefined,
					suffixTitle: suffixHref ? "Wayback Machine" : undefined,
				};
			});

		return { items };
	}

	/**
	 * Reads publish time from snake_case or camelCase records.
	 *
	 * `null` means "already published" in this app and must not be treated as preview.
	 */
	private static publishedAt(input: unknown): string | null {
		let record = input as { published_at?: string | null; publishedAt?: string | null };
		return record.published_at ?? record.publishedAt ?? null;
	}

	/**
	 * Reads creation time from snake_case or camelCase records.
	 *
	 * Returns an empty string when missing so timestamp parsing can fail safely.
	 */
	private static createdAt(input: unknown): string {
		let record = input as { created_at?: string; createdAt?: string };
		return record.created_at ?? record.createdAt ?? "";
	}

	/**
	 * Computes a sortable activity timestamp for ordering bookmarks.
	 *
	 * Uses publish time first, then creation time as fallback. Invalid dates produce
	 * `NaN`, which keeps behavior explicit without throwing during sort.
	 */
	private static activityTimestamp(input: unknown): number {
		let publishedAt = this.publishedAt(input);
		let createdAt = this.createdAt(input);
		let value = publishedAt ?? createdAt;
		let timestamp = Date.parse(value);
		return Number.isFinite(timestamp) ? timestamp : Number.NaN;
	}
}
