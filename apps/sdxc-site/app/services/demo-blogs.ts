/**
 * Reads a demo blog's posts: their front matter for the lists, and one post's body anchored,
 * painted and measured for its page. Lists, related posts and neighbours are worked out here,
 * so every page of a blog orders and relates its posts the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Anchor } from "~/app/services/article";
import type { DemoBlogSite } from "~/resources/views/demo-blogs";

import { prepareArticle, tableOfContents } from "~/app/services/article";

/** What every post's front matter declares. */
export const POST_FRONTMATTER = s.object({
	title: s.string(),
	description: s.string(),
	/** The path segment of the kind the post belongs to, a key of the blog's `kinds`. */
	kind: s.string(),
	/** When the post went out, as `YYYY-MM-DD`. */
	date: s.string(),
	updated: s.optional(s.string()),
	tags: s.array(s.string()),
	/** Puts the post at the top of the home; the newest featured post wins. */
	featured: s.optional(s.boolean()),
	/** Where a bookmark links out to. */
	url: s.optional(s.string()),
	/** The series a post is one part of, which its page lists in order. */
	series: s.optional(s.string()),
	/** The post's place in its series, counted from 1. */
	part: s.optional(s.number()),
});

/** The options every post is read with. */
const POST_OPTIONS = { frontmatter: POST_FRONTMATTER } satisfies Markdown.Options;

/** Words a reader gets through in a minute, which a post's reading time is counted from. */
const WORDS_PER_MINUTE = 230;

/** One post as the lists read it, without its body. */
export interface DemoBlogPost extends s.InferOutput<typeof POST_FRONTMATTER> {
	slug: string;
	/** The post's path under the blog, `<kind>/<slug>`. */
	path: string;
	/** Whole minutes to read the body, at least one. */
	minutes: number;
	/** The body as plain text, which search matches against. */
	text: string;
	/**
	 * The body painted for a stream, for a kind whose layout lists a post in full (a note);
	 * `null` for every other kind, whose stream row is its title and lead.
	 */
	body: Markdown.Document | null;
}

/** One post ready for its page: its listing, its prepared body and its outline. */
export interface DemoBlogArticle {
	post: DemoBlogPost;
	document: Markdown.Document;
	toc: Anchor[];
}

/**
 * Reads one post's front matter and counts its reading time from the body.
 *
 * @returns The listing, or the parse failure naming the post.
 */
function readPost(site: DemoBlogSite, slug: string, source: string): Result<DemoBlogPost, Error> {
	let parsed = Markdown.parse(source, POST_OPTIONS);
	if (isFailure(parsed)) return failure(new Error(`${slug}: ${parsed.error.message}`));
	let { document, frontmatter } = parsed.data;
	if (!Object.hasOwn(site.kinds, frontmatter.kind)) {
		return failure(new Error(`${slug}: the blog has no kind "${frontmatter.kind}"`));
	}
	let text = toPlainText(document);
	let words = text.split(/\s+/).filter(Boolean).length;
	let listed = site.kinds[frontmatter.kind]?.layout === "note";
	let body = listed ? prepareArticle(document, POST_OPTIONS) : null;
	if (body !== null && isFailure(body)) return failure(new Error(`${slug}: ${body.error.message}`));
	return success({
		...frontmatter,
		slug,
		path: `${frontmatter.kind}/${slug}`,
		minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
		text,
		body: body?.data ?? null,
	});
}

/**
 * Every post of a blog, newest first. A post whose front matter fails to read is left out,
 * and the blog's tests name it.
 */
export async function listPosts(site: DemoBlogSite): Promise<DemoBlogPost[]> {
	let posts = await Promise.all(
		Object.entries(site.posts).map(async ([slug, load]) => readPost(site, slug, await load())),
	);
	return posts
		.flatMap((post) => (isFailure(post) ? [] : [post.data]))
		.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/**
 * Reads one post for its page.
 *
 * @param site The blog.
 * @param kind The kind segment the address carried.
 * @param slug The post's slug.
 * @returns The post, `null` when the blog has no such post under that kind.
 */
export async function readArticle(
	site: DemoBlogSite,
	kind: string,
	slug: string,
): Promise<Result<DemoBlogArticle | null, Error>> {
	let load = Object.hasOwn(site.posts, slug) ? site.posts[slug] : undefined;
	if (load === undefined) return success(null);
	let source = await load();
	let post = readPost(site, slug, source);
	if (isFailure(post)) return post;
	if (post.data.kind !== kind) return success(null);
	let parsed = Markdown.parse(source, POST_OPTIONS);
	if (isFailure(parsed)) return failure(parsed.error);
	let prepared = prepareArticle(parsed.data.document, POST_OPTIONS);
	if (isFailure(prepared)) return failure(prepared.error);
	return success({
		post: post.data,
		document: prepared.data,
		toc: tableOfContents(prepared.data),
	});
}

/**
 * The posts beside one in publishing order, so the end of a post reads on to its neighbour.
 *
 * @param posts Every post, newest first.
 * @returns `older` the post published before, `newer` the one after, either `null` at an end.
 */
export function findNeighbourPosts(
	posts: DemoBlogPost[],
	path: string,
): { older: DemoBlogPost | null; newer: DemoBlogPost | null } {
	let index = posts.findIndex((post) => post.path === path);
	if (index === -1) return { older: null, newer: null };
	return { older: posts[index + 1] ?? null, newer: posts[index - 1] ?? null };
}

/**
 * The posts sharing the most tags with one, ties broken by recency; a post sharing none is
 * left out, so a reader is never offered something unrelated.
 *
 * @param limit How many to offer.
 * @default limit 3
 */
export function findRelatedPosts(
	posts: DemoBlogPost[],
	post: DemoBlogPost,
	limit = 3,
): DemoBlogPost[] {
	return posts
		.filter((other) => other.path !== post.path)
		.map((other) => ({
			other,
			shared: other.tags.filter((tag) => post.tags.includes(tag)).length,
		}))
		.filter((entry) => entry.shared > 0)
		.sort((a, b) => b.shared - a.shared || b.other.date.localeCompare(a.other.date))
		.slice(0, limit)
		.map((entry) => entry.other);
}

/**
 * Every tag with how many posts carry it, the most used first.
 *
 * @returns One entry per tag, ties in name order.
 */
export function countTags(posts: DemoBlogPost[]): Array<{ tag: string; count: number }> {
	let counts = new Map<string, number>();
	for (let post of posts) {
		for (let tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	return [...counts]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Posts grouped by the year they went out, newest year first.
 *
 * @param posts Every post, newest first, which each group keeps.
 */
export function groupByYear(posts: DemoBlogPost[]): Array<{ year: string; posts: DemoBlogPost[] }> {
	let years: Array<{ year: string; posts: DemoBlogPost[] }> = [];
	for (let post of posts) {
		let year = post.date.slice(0, 4);
		let group = years.at(-1);
		if (group?.year === year) group.posts.push(post);
		else years.push({ year, posts: [post] });
	}
	return years;
}

/**
 * The post the home leads with: the newest one marked `featured`, else the newest post.
 *
 * @returns The post, `null` for a blog with no posts.
 */
export function findFeaturedPost(posts: DemoBlogPost[]): DemoBlogPost | null {
	return posts.find((post) => post.featured) ?? posts[0] ?? null;
}

/**
 * The posts of one series in reading order.
 *
 * @returns Every part, first part first; empty for a post in no series.
 */
export function listSeries(posts: DemoBlogPost[], series: string | undefined): DemoBlogPost[] {
	if (series === undefined) return [];
	return posts
		.filter((post) => post.series === series)
		.sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
}

/**
 * The posts matching every word of a query in their title, lead, tags or body, the ones
 * matching in the title first, then newest first. A blank query matches nothing.
 *
 * @param query What the reader typed, matched case-insensitively word by word.
 */
export function searchPosts(posts: DemoBlogPost[], query: string): DemoBlogPost[] {
	let words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	let haystack = (post: DemoBlogPost) =>
		[post.title, post.description, post.tags.join(" "), post.text].join(" ").toLowerCase();
	let inTitle = (post: DemoBlogPost) =>
		words.some((word) => post.title.toLowerCase().includes(word));
	return posts
		.filter((post) => words.every((word) => haystack(post).includes(word)))
		.sort((a, b) => Number(inTitle(b)) - Number(inTitle(a)) || b.date.localeCompare(a.date));
}

/**
 * How many posts of each kind a list holds, in the blog's own kind order, so a filter row
 * says what each choice leads to and leaves out a kind with none.
 */
export function countKinds(
	site: DemoBlogSite,
	posts: DemoBlogPost[],
): Array<{ kind: string; count: number }> {
	return Object.keys(site.kinds)
		.map((kind) => ({ kind, count: posts.filter((post) => post.kind === kind).length }))
		.filter((entry) => entry.count > 0);
}
