/**
 * The posts list as a query: the status tab, author and tag facets, search and sort a visitor
 * sets in the address, read with `remix/data-schema` and applied to the fixtures, so a
 * filtered list is a link that opens the same view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemanticColor } from "@sdxc/ui/utils";

import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { Post, PostStatus } from "~/resources/views/demo-apps/inkwell/data";

import { findAuthor, postDate } from "~/resources/views/demo-apps/inkwell/data";

/** The status tab a list shows; `all` is every post. */
export type StatusTab = PostStatus | "all";

/** How the list is ordered: by its Date column, newest first, or by title. */
export type PostSort = "-date" | "date" | "title" | "-title";

/** The one status vocabulary the app uses, in the list, the editor and the quick edit. */
export const STATUS_LABEL: Record<PostStatus, string> = {
	published: "Published",
	draft: "Draft",
	scheduled: "Scheduled",
};

/** The tone each status reads in: live is success, queued is the brand ink, a draft is quiet. */
export const STATUS_COLOR: Record<PostStatus, SemanticColor> = {
	published: "success",
	draft: "neutral",
	scheduled: "brand",
};

/** The parameters the list owns, which Clear filters drops and a form's redirect may carry. */
export const LIST_PARAMS = ["status", "author", "tag", "q", "sort"] as const;

/** The list's search params, each falling back to the unfiltered view when absent or unknown. */
const LIST_QUERY = f.object({
	status: f.field(s.defaulted(s.enum_(["all", "published", "draft", "scheduled"]), "all")),
	author: f.fields(s.array(s.string())),
	tag: f.fields(s.array(s.string())),
	q: f.field(s.defaulted(s.string(), "")),
	sort: f.field(s.defaulted(s.enum_(["-date", "date", "title", "-title"]), "-date")),
});

/** What the list's address asks for. */
export interface PostsQuery {
	status: StatusTab;
	author: string[];
	tag: string[];
	q: string;
	sort: PostSort;
}

/** The view a malformed address falls back to: every post, newest first. */
const DEFAULT_QUERY: PostsQuery = { status: "all", author: [], tag: [], q: "", sort: "-date" };

/**
 * Reads the list's query from its address; a value the schema rejects drops the whole query
 * back to the unfiltered list rather than failing the screen.
 *
 * @param params The address's search params.
 * @returns The query to apply.
 */
export function readPostsQuery(params: URLSearchParams): PostsQuery {
	let result = s.parseSafe(LIST_QUERY, params);
	if (!result.success) return DEFAULT_QUERY;
	return { ...result.value, q: result.value.q.trim() };
}

/**
 * The posts that match every facet and the search, before the status tab narrows them, so
 * each tab can count what it would show.
 *
 * @param posts The posts to filter.
 * @param query The list's query.
 * @returns The posts matching the facets and search.
 */
export function matchFacets(posts: Post[], query: PostsQuery): Post[] {
	let needle = query.q.toLowerCase();
	return posts.filter((post) => {
		if (query.author.length > 0 && !query.author.includes(post.authorId)) return false;
		if (query.tag.length > 0 && !query.tag.some((tag) => post.tags.includes(tag))) return false;
		if (needle === "") return true;
		let haystack = `${post.title} ${post.excerpt} ${findAuthor(post.authorId).name}`;
		return haystack.toLowerCase().includes(needle);
	});
}

/**
 * Applies the whole query: facets, search, the status tab and the sort.
 *
 * @param posts The posts to filter.
 * @param query The list's query.
 * @param now The render's reference moment, which dates are measured from.
 * @returns The posts the list shows, in order.
 */
export function applyPostsQuery(posts: Post[], query: PostsQuery, now: Date): Post[] {
	let matching = matchFacets(posts, query).filter(
		(post) => query.status === "all" || post.status === query.status,
	);
	let direction = query.sort.startsWith("-") ? -1 : 1;
	return [...matching].sort((a, b) => {
		if (query.sort.endsWith("title")) return direction * a.title.localeCompare(b.title);
		return direction * (postDate(a, now).getTime() - postDate(b, now).getTime());
	});
}

/**
 * Keeps only the list's own parameters from a query string a form carried back, so a redirect
 * returns to the same filtered list and can never be steered elsewhere.
 *
 * @param search A query string, with or without its leading `?`.
 * @returns The list's page path with the kept parameters.
 */
export function postsListPage(search: string): string {
	let incoming = new URLSearchParams(search);
	let kept = new URLSearchParams();
	for (let name of LIST_PARAMS) {
		for (let value of incoming.getAll(name)) kept.append(name, value);
	}
	let query = kept.toString();
	return query === "" ? "posts" : `posts?${query}`;
}
