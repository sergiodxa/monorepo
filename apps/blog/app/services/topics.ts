/**
 * What a topic lists, read across post types: the topic's query as its page and feeds run it,
 * and the posts behind a page of matches, loaded through each type's own model so every row
 * and feed entry shows what that kind's own listing always showed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ParsedQuery } from "@sdxc/search";
import type { Database } from "remix/data-table";

import { isFailure } from "@sdxc/result";
import { inList } from "remix/data-table";

import type { BlogModels } from "~/app/models";
import type { Article } from "~/app/models/articles";
import type { GlossaryEntry } from "~/app/models/glossary";
import type { Like } from "~/app/models/likes";
import type { Note } from "~/app/models/notes";
import type { Post } from "~/app/models/posts";
import type { Til } from "~/app/models/tils";
import type { Tutorial } from "~/app/models/tutorials";
import type { SelectTopic } from "~/database/schema";

import { KINDS, POST_KINDS } from "~/app/models/kinds";
import { PostSearch } from "~/app/models/search";
import { isBuiltInTopic } from "~/app/models/topics";

/**
 * One match of a topic with the post it found, read through the post's own model. A kind
 * with no listing of its own reads as `other`, its base row beside the search hit.
 */
export type TopicPost =
	| { kind: "article"; hit: PostSearch.Hit; post: Article }
	| { kind: "tutorial"; hit: PostSearch.Hit; post: Tutorial }
	| { kind: "glossary"; hit: PostSearch.Hit; post: GlossaryEntry }
	| { kind: "bookmark"; hit: PostSearch.Hit; post: Like }
	| { kind: "note"; hit: PostSearch.Hit; post: Note }
	| { kind: "til"; hit: PostSearch.Hit; post: Til }
	| { kind: "other"; hit: PostSearch.Hit; post: Post };

/**
 * A topic's query as its page runs it: newest first unless the query asks for an `order:`.
 *
 * @param topic The topic whose stored query runs.
 * @returns The parsed query, or `null` for a stored query that no longer parses, which lists
 * nothing.
 */
export function topicQuery(topic: Pick<SelectTopic, "query">): ParsedQuery | null {
	let parsed = PostSearch.parse(topic.query);
	if (isFailure(parsed) || parsed.data === null) return null;
	return parsed.data.order === "relevance" ? { ...parsed.data, order: "desc" } : parsed.data;
}

/**
 * A topic's query as its feeds run it: always newest first, whatever `order:` says, since a
 * feed reader shows the newest items.
 *
 * @param topic The topic whose stored query runs.
 */
export function topicFeedQuery(topic: Pick<SelectTopic, "query">): ParsedQuery | null {
	let parsed = topicQuery(topic);
	return parsed === null ? null : { ...parsed, order: "desc" };
}

/**
 * Whether a topic is a kind's topic whose posts are read as entries of the topic page, such as
 * the glossary's: that page lists every entry at once, so each entry's anchor resolves.
 *
 * @param topic The topic about to be listed.
 */
export function listsEveryEntry(topic: Pick<SelectTopic, "slug">): boolean {
	return KINDS.some(
		(kind) => POST_KINDS[kind].topic === topic.slug && POST_KINDS[kind].permalink === "entry",
	);
}

/**
 * Loads the post behind each hit, one batched read per kind, keeping the hits' order. A hit
 * whose post is gone by the time it is read is left out.
 *
 * @param models The invocation's models.
 * @param hits Matches from a topic's search.
 */
export async function topicPosts(
	models: BlogModels,
	hits: ReadonlyArray<PostSearch.Hit>,
): Promise<Array<TopicPost>> {
	let idsOf = (kind: string) => hits.filter((hit) => hit.kind === kind).map((hit) => hit.id);
	let known = new Set<string>(["article", "tutorial", "glossary", "bookmark", "note", "til"]);
	let others = hits.filter((hit) => !known.has(hit.kind)).map((hit) => hit.id);

	let [articles, tutorials, glossary, bookmarks, notes, tils, rest] = await Promise.all([
		byIds(idsOf("article"), (ids) => models.articles.query().where(inList("id", ids)).all()),
		byIds(idsOf("tutorial"), (ids) => models.tutorials.query().where(inList("id", ids)).all()),
		byIds(idsOf("glossary"), (ids) => models.glossary.query().where(inList("id", ids)).all()),
		byIds(idsOf("bookmark"), (ids) => models.likes.query().where(inList("id", ids)).all()),
		byIds(idsOf("note"), (ids) => models.notes.query().where(inList("id", ids)).all()),
		byIds(idsOf("til"), (ids) => models.tils.query().where(inList("id", ids)).all()),
		byIds(others, (ids) => models.posts.query().where(inList("id", ids)).all()),
	]);

	return hits.flatMap((hit): Array<TopicPost> => {
		if (hit.kind === "article")
			return found(articles, hit, (post) => ({ kind: "article", hit, post }));
		if (hit.kind === "tutorial")
			return found(tutorials, hit, (post) => ({ kind: "tutorial", hit, post }));
		if (hit.kind === "glossary")
			return found(glossary, hit, (post) => ({ kind: "glossary", hit, post }));
		if (hit.kind === "bookmark")
			return found(bookmarks, hit, (post) => ({ kind: "bookmark", hit, post }));
		if (hit.kind === "note") return found(notes, hit, (post) => ({ kind: "note", hit, post }));
		if (hit.kind === "til") return found(tils, hit, (post) => ({ kind: "til", hit, post }));
		return found(rest, hit, (post) => ({ kind: "other", hit, post }));
	});
}

/** Reads rows by id, skipping the read when there are none, and indexes them by id. */
async function byIds<Row extends { id: string }>(
	ids: Array<string>,
	read: (ids: Array<string>) => Promise<Array<Row>>,
): Promise<Map<string, Row>> {
	if (ids.length === 0) return new Map();
	let rows = await read(ids);
	return new Map(rows.map((row) => [row.id, row]));
}

/** The hit's post wrapped as a topic post, or nothing when its post is gone. */
function found<Row>(
	rows: Map<string, Row>,
	hit: PostSearch.Hit,
	wrap: (post: Row) => TopicPost,
): Array<TopicPost> {
	let post = rows.get(hit.id);
	return post === undefined ? [] : [wrap(post)];
}

/**
 * A kind's topic by its slug, for the fixed routes at the root that serve only kinds' topics;
 * `null` for a slug no kind names, or a kind whose topic row is missing.
 *
 * @param models The invocation's models.
 * @param slug The slug from the URL.
 */
export async function findKindTopic(models: BlogModels, slug: string): Promise<SelectTopic | null> {
	if (!isBuiltInTopic(slug)) return null;
	return models.topics.findBy({ slug });
}

/**
 * Every post a topic's feeds carry, newest first, with the post behind each match.
 *
 * @param ctx The invocation's database and models.
 * @param topic The topic the feed follows.
 */
export async function topicFeedPosts(
	ctx: { db: Database; models: BlogModels },
	topic: SelectTopic,
): Promise<Array<TopicPost>> {
	let query = topicFeedQuery(topic);
	if (query === null) return [];
	return topicPosts(ctx.models, await PostSearch.all(ctx.db, query));
}

/**
 * Posts ordered by what a reader looks them up by: a glossary entry by its term, any other
 * post by its title, so a page listing every entry reads as a reference.
 *
 * @param posts A topic's posts.
 */
export function alphabetical(posts: ReadonlyArray<TopicPost>): Array<TopicPost> {
	let nameOf = (post: TopicPost) =>
		post.kind === "glossary" ? post.post.meta.term : post.hit.title;
	return [...posts].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
}
