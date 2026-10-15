/**
 * View model for the activity feed page. Maps repository feed records into render-ready
 * timeline rows, selecting per-kind copy and routes for articles, tutorials,
 * bookmarks, and glossary entries, parsing what notes and TILs show in place, and dropping
 * entries missing required routing data. It centralizes feed presentation so controllers remain thin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";
import { titleize } from "@sdxc/strings";

import type { Feed } from "~/app/models/feed";
import type { Kind } from "~/app/models/kinds";

import { noteTitle, normalizeUrl } from "~/app/models/post-values";
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
		/** Full sentence describing the activity, written in first person and headline-cased. */
		label: string;
		date: string;
		/** Whether the activity points to preview-only content. */
		preview: boolean;
		/**
		 * What the activity is, which picks the row's emoji. A `bookmark`'s `href` is someone
		 * else's page the author saved, marked up as the entry's `bookmark-of`.
		 */
		kind: Kind;
		/**
		 * What a note or TIL shows in place of a linked line, its date then linking to `href`;
		 * absent for every other kind.
		 */
		inline?: Inline;
	}

	/** A short post read in the index itself. */
	export interface Inline {
		/** A TIL's title; a note has none. */
		title: string | null;
		/** The parsed content; `null` when it is blank or does not parse. */
		document: Markdown.Document | null;
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
 * This class centralizes copy and route selection per feed kind so controllers
 * stay thin.
 */
export class FeedViewModel {
	/**
	 * Enforces the URL requirements of each kind: entries missing their `slug` or
	 * `url` are dropped so every rendered row links somewhere valid. Every label is
	 * headline-cased whole, so the sentence and the title inside it read as one.
	 *
	 * @param activity Feed items from the data layer.
	 * @returns Render-safe feed payload with timeline metadata per activity kind.
	 */
	static index(activity: Array<Feed.ActivityItem>): FeedViewModel.Page {
		let items = activity
			.map((item): FeedViewModel.ActivityItem | null => {
				if (item.kind === "article") {
					if (!item.slug) return null;

					return {
						href: routes.post.href({ postType: "articles", postSlug: item.slug }),
						label: `I wrote about ${item.title}`,
						date: item.date,
						preview: item.preview,
						kind: "article",
					};
				}

				if (item.kind === "tutorial") {
					if (!item.slug) return null;

					return {
						href: routes.post.href({ postType: "tutorials", postSlug: item.slug }),
						label: `I published how to ${item.title}`,
						date: item.date,
						preview: item.preview,
						kind: "tutorial",
					};
				}

				if (item.kind === "bookmark") {
					if (!item.url) return null;

					return {
						href: normalizeUrl(item.url),
						label: `I saved ${item.title}`,
						date: item.date,
						preview: item.preview,
						kind: "bookmark",
					};
				}

				if (item.kind === "note" || item.kind === "til") {
					if (!item.slug) return null;
					let til = item.kind === "til";

					return {
						href: routes.post.href({ postType: til ? "til" : "notes", postSlug: item.slug }),
						label: til ? `TIL ${item.title}` : noteTitle(item.content ?? ""),
						date: item.date,
						preview: item.preview,
						kind: item.kind,
						inline: this.inline(item.kind, { title: item.title, content: item.content ?? "" }),
					};
				}

				if (item.kind === "release") {
					if (!item.slug) return null;

					return {
						href: routes.post.href({ postType: "releases", postSlug: item.slug }),
						label: `I listed what I released in ${item.slug.toUpperCase()}`,
						date: item.date,
						preview: item.preview,
						kind: "release",
					};
				}

				if (!item.slug) return null;

				return {
					href: `${routes.glossary.href()}#${item.slug}`,
					label: `I added the definition of ${item.title}`,
					date: item.date,
					preview: item.preview,
					kind: "glossary",
				};
			})
			.filter(this.isActivityItem)
			.map((item) => ({ ...item, label: titleize(item.label) }));

		return { activity: items };
	}

	/**
	 * What a list shows of a note or TIL in place: a TIL's title, and the content parsed, which
	 * shows nothing when blank or unparseable rather than failing the whole page.
	 *
	 * @param kind Which short post it is; only a TIL keeps its title.
	 * @param post Its stored title, if any, and Markdown.
	 */
	static inline(
		kind: "note" | "til",
		post: { title?: string; content: string },
	): FeedViewModel.Inline {
		let title = kind === "til" ? (post.title ?? null) : null;
		if (post.content.trim() === "") return { title, document: null };
		let parsed = Markdown.parse(post.content);
		return { title, document: isFailure(parsed) ? null : parsed.data.document };
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
		item: FeedViewModel.ActivityItem | null,
	): item is FeedViewModel.ActivityItem {
		return item !== null;
	}
}
