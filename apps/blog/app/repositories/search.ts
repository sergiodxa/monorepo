/**
 * Cross-type search over the published corpus. `post_search` is a search-only projection of
 * each live post (title, tags, content) behind an FTS5 index; kind, publish state and every
 * field a result shows are read from `posts` and `post_meta`, which stay the source of truth.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Page, PaginationError } from "@sdxc/pagination";
import type { Result } from "@sdxc/result";
import type { ParsedQuery, SearchQuery } from "@sdxc/search";
import type { ValidationError } from "@sdxc/validate";
import type { Database, SqlStatement } from "remix/data-table";

import { Pagination } from "@sdxc/pagination";
import { isFailure, success } from "@sdxc/result";
import { defineSearch, parseQuery } from "@sdxc/search";
import { and, inList, rawSql, sql } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import * as schema from "~/database/schema";

/**
 * Type contracts for searching. Type-only, so the runtime logic stays on
 * {@link PostSearch}.
 */
export namespace PostSearch {
	/** The content types a search can reach. */
	export type Kind = "article" | "tutorial" | "glossary";

	/** Narrowing a search accepts beyond its text. */
	export interface Filters {
		/** Restricts the search to one type. */
		kind?: Kind;
		/** Restricts the results to posts carrying this tag, compared without case. */
		tag?: string;
	}

	/** What a caller is asking for. */
	export interface Options extends Filters {
		/** Free text matched against titles, tags and post bodies. */
		query: string;
		/** Largest number of results to return. */
		limit?: number;
	}

	/** One page of a search a person reads, numbered from 1. */
	export interface PageOptions extends Filters {
		/** The query from {@link PostSearch.parse}, which the caller also highlights with. */
		query: ParsedQuery;
		page: number;
		perPage: number;
	}

	/** One hit, shaped for a machine reader. */
	export interface Result {
		kind: Kind;
		title: string;
		slug: string;
		/** The public URL of the post, so a caller can cite what it quotes. */
		url: string;
		/** The post's summary: an article's or tutorial's excerpt, a glossary entry's definition. */
		excerpt: string | undefined;
		tags: Array<string>;
		/** Publication instant as ISO 8601 when the post has one, or `null` otherwise. */
		publishedAt: string | null;
	}

	/**
	 * A result on a page a person reads, with the text it was found in, so a reader can be
	 * shown where a match sits in a post whose summary does not hold it.
	 */
	export interface Hit extends Result {
		/** The post's searchable body: Markdown for a post, a glossary entry's definition. */
		body: string;
	}
}

/** Every kind a search reaches. */
const KINDS: ReadonlyArray<PostSearch.Kind> = ["article", "tutorial", "glossary"];

/** Where each kind's pages live, used to build a result's public URL. */
const KIND_PATHS: Record<PostSearch.Kind, string> = {
	article: "/articles",
	tutorial: "/tutorials",
	glossary: "/glossary",
};

/** The `post_meta` keys a result is read from. */
const RESULT_META_KEYS = ["slug", "title", "term", "excerpt", "definition"];

/**
 * `posts.published_at` as epoch milliseconds, read the way `Post.isPublishedAt` reads it: a
 * run of digits is seconds (or milliseconds past 10^12), anything else a date SQLite parses.
 * Text SQLite cannot parse comes out `NULL`, which never compares as published.
 */
const PUBLISHED_MS = `case
	when "posts"."published_at" glob '[0-9]*' and "posts"."published_at" not glob '*[^0-9]*' then
		case when cast("posts"."published_at" as integer) > 1000000000000
			then cast("posts"."published_at" as integer)
			else cast("posts"."published_at" as integer) * 1000 end
	else cast(round((julianday("posts"."published_at") - 2440587.5) * 86400000) as integer)
end`;

/** Whether a stored type is one search reaches. */
function isKind(value: string): value is PostSearch.Kind {
	return Object.hasOwn(KIND_PATHS, value);
}

/**
 * The search over `post_search`: a title hit outranks a tag hit, which outranks a hit in the
 * body, weighted inside `bm25()` so a body dense with a term can still beat a passing title.
 */
const postSearch = defineSearch({
	table: schema.postSearch,
	key: "id",
	columns: [
		{ name: "title", weight: 10 },
		{ name: "tags", weight: 6 },
		{ name: "content", weight: 1 },
	],
	fts: { table: "post_search_fts" },
});

/** The searchable text a post is projected as. */
interface Projection {
	title: string;
	tags: Array<string>;
	content: string;
}

/** Searches the published corpus across content types, and keeps its projection current. */
export class PostSearch {
	/**
	 * Parses what somebody typed with the options every search here shares, so the query a
	 * caller highlights with is the one the search ran.
	 *
	 * @param text The raw search box text.
	 * @returns The terms, `null` for blank text, or a `ValidationError` for text with nothing
	 * to find, too many terms, or too many characters.
	 */
	static parse(text: string): Result<ParsedQuery | null, ValidationError> {
		return parseQuery(text);
	}

	/**
	 * Finds published posts matching `query`, best match first.
	 *
	 * @param db Database connection holding `post_search` and the posts it projects.
	 * @param options The query, and any narrowing by kind, tag or count.
	 * @returns Hits in relevance order. Empty when the query is blank or holds nothing to
	 * search for, since every post would otherwise match.
	 * @example
	 * let hits = await PostSearch.query(db, { query: "remix", kind: "tutorial", limit: 5 });
	 */
	static async query(db: Database, options: PostSearch.Options): Promise<Array<PostSearch.Result>> {
		let parsed = this.parse(options.query);
		if (isFailure(parsed) || parsed.data === null) return [];

		let limit = options.limit ?? 10;
		if (limit <= 0) return [];

		let rows = await this.matching(db, parsed.data, options).limit(limit).all();
		let hits = await this.hits(db, rows);
		return hits.map(({ body: _body, ...result }) => result);
	}

	/**
	 * One numbered page of published posts matching a parsed query, best match first. A
	 * page past the end resolves to the last one, as `Pagination` clamps it.
	 *
	 * @param db Database connection holding `post_search` and the posts it projects.
	 * @param options The parsed query, the page wanted, and any narrowing.
	 * @returns The page with its total, each hit carrying the body it was found in, or a
	 * `PaginationError` when the database refuses.
	 */
	static async page(
		db: Database,
		options: PostSearch.PageOptions,
	): Promise<Result<Page<PostSearch.Hit>, PaginationError>> {
		let page = await Pagination.byOffset(this.matching(db, options.query, options), {
			page: options.page,
			perPage: options.perPage,
		});
		if (isFailure(page)) return page;

		return success({
			items: await this.hits(db, page.data.items),
			pagination: page.data.pagination,
		});
	}

	/**
	 * Writes a post's searchable text as the post now stands, in one upsert, or removes it
	 * when the post is deleted or of a kind search skips. Previews are projected too: a
	 * search reads publish state from `posts`, so a scheduled post appears on its date.
	 *
	 * @param db Database connection used for the read and the write.
	 * @param id The post just created or updated.
	 * @param type The post's stored type, which decides how its metadata is read.
	 */
	static async index(db: Database, id: string, type: Post.Type): Promise<void> {
		let projection = await this.projectionOf(db, id, type);
		if (projection === null) return this.remove(db, id);

		await db.exec(sql`
			insert into "post_search" ("post_id", "title", "tags", "content")
			values (${id}, ${projection.title}, ${JSON.stringify(projection.tags)}, ${projection.content})
			on conflict ("post_id") do update set
				"title" = excluded."title",
				"tags" = excluded."tags",
				"content" = excluded."content"
		`);
	}

	/**
	 * Removes a post's searchable text; the index follows through its delete trigger, and a
	 * post that never had a row is left as it was.
	 *
	 * @param db Database connection used for the write.
	 * @param id The post leaving search.
	 */
	static async remove(db: Database, id: string): Promise<void> {
		await db.exec(sql`delete from "post_search" where "post_id" = ${id}`);
	}

	/**
	 * Every match for `query` whose post is live, of a searchable kind (or the one asked for)
	 * and published by now, read from `posts` on every query so no projection can drift from
	 * it. A tag narrows on the projected tags.
	 */
	private static matching(
		db: Database,
		query: ParsedQuery,
		filters: PostSearch.Filters,
	): SearchQuery<typeof schema.postSearch> {
		let kinds = filters.kind === undefined ? KINDS : [filters.kind];
		let found = postSearch.query(db, query).where(this.published(kinds, Date.now()));

		if (filters.tag !== undefined) {
			found = found.where(
				sql`exists (select 1 from json_each("post_search"."tags") where lower("value") = lower(${filters.tag.trim()}))`,
			);
		}

		return found;
	}

	/** The source-table condition a projected row must meet to be returned. */
	private static published(kinds: ReadonlyArray<PostSearch.Kind>, now: number): SqlStatement {
		let placeholders = kinds.map(() => "?").join(", ");
		return rawSql(
			`exists (select 1 from "posts" where "posts"."id" = "post_search"."post_id" and "posts"."deleted_at" is null and "posts"."type" in (${placeholders}) and ("posts"."published_at" is null or (${PUBLISHED_MS}) <= ?))`,
			[...kinds, now],
		);
	}

	/**
	 * Reads each hit's post back from the source tables in two batched queries, keeping the
	 * search's order. A post deleted between the search and this read is left out.
	 */
	private static async hits(
		db: Database,
		rows: ReadonlyArray<schema.SelectPostSearch>,
	): Promise<Array<PostSearch.Hit>> {
		if (rows.length === 0) return [];

		let ids = rows.map((row) => row.post_id);
		let [posts, meta] = await Promise.all([
			db.findMany(schema.posts, { where: inList("id", ids) }),
			db.findMany(schema.postMeta, {
				where: and(inList("post_id", ids), inList("key", RESULT_META_KEYS)),
			}),
		]);

		let postsById = new Map(posts.map((post) => [post.id, post]));
		let metaByPost = new Map<string, Array<schema.SelectPostMeta>>();
		for (let row of meta) {
			let forPost = metaByPost.get(row.post_id) ?? [];
			forPost.push(row);
			metaByPost.set(row.post_id, forPost);
		}

		return rows.flatMap((row) => {
			let post = postsById.get(row.post_id);
			if (!post || post.deleted_at !== null || !isKind(post.type)) return [];
			let result = this.result(post.type, post, metaByPost.get(post.id) ?? [], row.tags);
			return [{ ...result, body: row.content }];
		});
	}

	/**
	 * Projects one post into the result shape callers and the MCP tool read: a glossary
	 * entry is titled by its alias or else its term and summarized by its definition, and
	 * tags come from the projection, which holds the post's tags normalized.
	 */
	private static result(
		kind: PostSearch.Kind,
		post: schema.SelectPost,
		meta: ReadonlyArray<schema.SelectPostMeta>,
		tags: string,
	): PostSearch.Result {
		let value = (key: string) => latestValue(meta, key);
		let slug = value("slug") ?? "";
		let timestamp = Post.timestampFromPublishedOrCreated(post);

		let title = value("title") ?? "";
		let excerpt = kind === "tutorial" ? (value("excerpt") ?? "") : value("excerpt");
		if (kind === "glossary") {
			title = value("title") ?? value("term") ?? "";
			excerpt = value("definition") ?? "";
		}

		return {
			kind,
			title,
			slug,
			url: `${KIND_PATHS[kind]}/${slug}`,
			excerpt,
			tags: kind === "tutorial" ? tagsOf(tags) : [],
			publishedAt: Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString(),
		};
	}

	/**
	 * Reads a post through its own type's repository, so the projection carries exactly the
	 * metadata the post's pages show. A glossary entry's title holds its term and its alias,
	 * so either one finds it, and its definition is its content.
	 *
	 * @returns The projection, or `null` when the post is deleted or of a kind search skips.
	 */
	private static async projectionOf(
		db: Database,
		id: string,
		type: Post.Type,
	): Promise<Projection | null> {
		if (type === "article") {
			let article = await ArticlePost.findById(db, id);
			if (!article) return null;
			return { title: article.meta.title, tags: [], content: article.meta.content };
		}

		if (type === "tutorial") {
			let tutorial = await TutorialPost.findById(db, id);
			if (!tutorial) return null;
			return {
				title: tutorial.meta.title,
				tags: TutorialPost.tags(tutorial.meta.tags),
				content: tutorial.meta.content,
			};
		}

		if (type === "glossary") {
			let entry = await GlossaryPost.findById(db, id);
			if (!entry) return null;
			return {
				title: [entry.meta.term, entry.meta.title].filter(Boolean).join(" "),
				tags: [],
				content: entry.meta.definition,
			};
		}

		return null;
	}
}

/**
 * The latest value stored under a metadata key, since an edit can leave more than one row
 * for it: newest `updated_at` wins, then newest `created_at`, as the post codecs resolve it.
 */
function latestValue(rows: ReadonlyArray<schema.SelectPostMeta>, key: string): string | undefined {
	let latest: schema.SelectPostMeta | undefined;
	for (let row of rows) {
		if (row.key !== key) continue;
		if (
			latest === undefined ||
			row.updated_at > latest.updated_at ||
			(row.updated_at === latest.updated_at && row.created_at > latest.created_at)
		) {
			latest = row;
		}
	}
	return latest?.value;
}

/** Reads a projected JSON tag array back, keeping only strings; anything else reads as none. */
function tagsOf(stored: string): Array<string> {
	try {
		let parsed: unknown = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((tag): tag is string => typeof tag === "string");
	} catch {
		return [];
	}
}
