/**
 * The documents a reader takes their library away in: the subscription list as OPML, the
 * posts they kept as CSV, and everything as one JSON file. The OPML download and the ZIP of
 * all three both write through here, so a subscription list reads the same in either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OPML } from "@sdxc/opml";
import type { Result } from "@sdxc/result";

import { stringify as stringifyCsv } from "@sdxc/csv";
import { toDayKey } from "@sdxc/dates";
import { stringify as stringifyOpml } from "@sdxc/opml";

import type { UserStore } from "~/database/user-do";

/** The columns of the saved-posts file, which read-later services map by these headers. */
const SAVED_COLUMNS = [
	"url",
	"title",
	"feed",
	"author",
	"published_at",
	"saved_at",
	"tags",
] as const;

/**
 * The subscription list as OPML, filed: one outline per folder holding its feeds, and the
 * unfiled ones after them, so another reader receives it organized the way it left.
 *
 * @param feeds - The subscriptions, as the reader's object exports them.
 * @param title - The document's own title, which the receiving reader shows.
 * @param now - When the export was taken, written as the document's creation date.
 */
export function subscriptionsOpml(
	feeds: readonly UserStore.FeedExport[],
	title: string,
	now: Date,
): string {
	let outlines = feeds.map<OPML.Outline>((feed) => ({
		title: feed.title,
		feedUrl: feed.feedUrl,
		siteUrl: feed.siteUrl ?? undefined,
		folder: feed.folder ?? undefined,
	}));
	return stringifyOpml(outlines, { title, dateCreated: now });
}

/**
 * The kept posts as CSV, one row per post with its labels joined by commas in one cell, the
 * shape read-later services and spreadsheets import. Dates are ISO 8601 in UTC, and a cell
 * starting like a formula is written as text.
 *
 * @param saved - The kept posts, newest kept first.
 * @returns The CSV text, or the failure writing it.
 */
export function savedPostsCsv(saved: readonly UserStore.SavedExport[]): Result<string, Error> {
	return stringifyCsv(
		saved.map((post) => ({
			url: post.url ?? "",
			title: post.title,
			feed: post.feed?.title ?? "",
			author: post.author ?? "",
			published_at: new Date(post.publishedAt).toISOString(),
			saved_at: new Date(post.savedAt).toISOString(),
			tags: post.tags.join(","),
		})),
		{ columns: SAVED_COLUMNS.map((key) => ({ key })) },
	);
}

/**
 * Everything the export holds, as one JSON document a script can read without parsing OPML
 * or CSV. `version` names the shape, so a later shape can be told apart from this one.
 *
 * @param feeds - The subscriptions.
 * @param saved - The kept posts.
 * @param now - When the export was taken.
 */
export function readerDataJson(
	feeds: readonly UserStore.FeedExport[],
	saved: readonly UserStore.SavedExport[],
	now: Date,
): string {
	let document = {
		version: 1,
		exportedAt: now.toISOString(),
		subscriptions: feeds,
		saved: saved.map((post) => ({
			...post,
			publishedAt: new Date(post.publishedAt).toISOString(),
			savedAt: new Date(post.savedAt).toISOString(),
		})),
	};
	return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * The name an export lands under: which app it came from, what it holds, and the day it was
 * taken, so this month's export sits beside last month's in a downloads folder.
 *
 * @param what - `subscriptions` for the OPML file, `export` for the ZIP of everything.
 * @param extension - The file's extension, without the dot.
 * @param now - When the export was taken.
 */
export function exportFilename(
	what: "subscriptions" | "export",
	extension: string,
	now: Date,
): string {
	return `reader-${what}-${toDayKey(now, "UTC")}.${extension}`;
}
