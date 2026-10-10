/**
 * Pure rules over post values: when a post counts as published, how posts order by date, how a
 * bookmarked URL is cleaned and keyed, and how tutorial tags are stored. Kept apart from the
 * models so search and the views read the same rules without loading a model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SelectPost } from "~/database/schema";

/** The discriminator values `posts.type` holds. */
export type PostType = SelectPost["type"];

/** The public collections a post page answers under. */
export type PublicTypePath = "articles" | "tutorials";

/** The stored `posts.type` behind each public collection path. */
export const PUBLIC_TYPES = { articles: "article", tutorials: "tutorial" } as const;

/**
 * Normalizes the timestamps a post may carry to epoch milliseconds: ISO strings, SQL datetime
 * strings, and second- or millisecond-based numbers and digit strings.
 *
 * @returns Epoch milliseconds, or `NaN` when the value cannot be read.
 */
export function parseTimestamp(value: string | number | null | undefined): number {
	if (value === null || value === undefined) return Number.NaN;

	if (typeof value === "number") {
		if (!Number.isFinite(value)) return Number.NaN;
		return value > 1_000_000_000_000 ? value : value * 1000;
	}

	let parsed = Date.parse(value);
	if (Number.isFinite(parsed)) return parsed;

	let match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)$/.exec(value);
	if (match) {
		let fallback = Date.parse(`${match[1]}T${match[2]}Z`);
		if (Number.isFinite(fallback)) return fallback;
	}

	if (/^\d+$/.test(value)) {
		let numeric = Number(value);
		if (!Number.isFinite(numeric)) return Number.NaN;
		return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
	}

	return Number.NaN;
}

/**
 * Whether a post is public now: `null` publishes immediately, a past date has arrived, and a
 * future or unreadable one keeps the post a preview.
 */
export function isPublishedAt(published_at: string | null): boolean {
	if (published_at === null) return true;
	let timestamp = parseTimestamp(published_at);
	if (Number.isNaN(timestamp)) return false;
	return timestamp <= Date.now();
}

/** A post's date for ordering: its publish date, else its creation date, as epoch milliseconds. */
export function timestampFromPublishedOrCreated(input: {
	published_at: string | null;
	created_at: string;
}): number {
	return parseTimestamp(input.published_at ?? input.created_at);
}

/** Orders posts newest first by {@link timestampFromPublishedOrCreated}. */
export function compareByPublishedOrCreatedDesc(
	a: { published_at: string | null; created_at: string },
	b: { published_at: string | null; created_at: string },
): number {
	return timestampFromPublishedOrCreated(b) - timestampFromPublishedOrCreated(a);
}

/** Query parameters that only track a visit, which a saved bookmark leaves off. */
const TRACKING_PARAMETER = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;

/** Gives a scheme-less URL `https://`, leaving absolute and root-relative ones as they are. */
export function normalizeUrl(url: string): string {
	if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) return url;
	return `https://${url}`;
}

/** A bookmark URL as it is saved: normalized, with tracking parameters removed. */
export function cleanUrl(input: string): string {
	let normalized = normalizeUrl(input.trim());
	if (normalized.startsWith("/") || !URL.canParse(normalized)) return normalized;

	let url = new URL(normalized);
	for (let key of Array.from(url.searchParams.keys())) {
		if (TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
	}
	return url.href;
}

/**
 * The address duplicates are judged by: no scheme, no `www.`, no trailing `/`, and the host
 * lowercased, so two spellings of one page claim the same bookmark.
 */
export function bookmarkAddress(url: string): string {
	let rest = url.trim().replace(/^https?:\/\//i, "");
	let ends = ["/", "?", "#"].map((mark) => rest.indexOf(mark)).filter((index) => index >= 0);
	let end = Math.min(rest.length, ...ends);

	let host = rest.slice(0, end).replaceAll(/[A-Z]/g, (letter) => letter.toLowerCase());
	if (host.startsWith("www.")) host = host.slice(4);

	let address = `${host}${rest.slice(end)}`;
	return address.endsWith("/") ? address.slice(0, -1) : address;
}

/** What a bookmark is listed as: its title, else its URL without the scheme. */
export function bookmarkLabel(meta: { title: string; url: string }): string {
	let title = meta.title.trim();
	if (title !== "") return title;
	return normalizeUrl(meta.url).replace(/^https?:\/\//i, "");
}

/** The Wayback Machine URL of a capture made at `at`, or `null` when `at` is not a date. */
export function waybackSnapshotUrl(url: string, at: string): string | null {
	let instant = new Date(at);
	if (Number.isNaN(instant.getTime())) return null;
	let timestamp = instant.toISOString().replaceAll(/\D/g, "").slice(0, 14);
	return `https://web.archive.org/web/${timestamp}/${url}`;
}

/** Trims and de-duplicates tags, dropping empty ones, in the order given. */
function distinctTags(values: readonly unknown[]): string[] {
	let tags: string[] = [];
	for (let value of values) {
		if (typeof value !== "string") continue;
		let tag = value.trim();
		if (tag !== "" && !tags.includes(tag)) tags.push(tag);
	}
	return tags;
}

/**
 * A tutorial's tags as stored in its `tags` meta value: a JSON array, or a single plain tag
 * written before tags were lists.
 */
export function tutorialTags(stored: string | readonly string[] | undefined): string[] {
	if (stored === undefined) return [];
	if (typeof stored !== "string") return distinctTags(stored);
	if (stored.trim() === "") return [];

	try {
		let parsed: unknown = JSON.parse(stored);
		return Array.isArray(parsed) ? distinctTags(parsed) : [];
	} catch {
		return distinctTags([stored]);
	}
}

/** Stores tags as the JSON array a tutorial's `tags` meta holds, or `null` to remove the key. */
export function serializeTags(input: string | readonly string[] | undefined): string | null {
	if (input === undefined) return null;
	let tags = distinctTags(typeof input === "string" ? [input] : input);
	return tags.length === 0 ? null : JSON.stringify(tags);
}
