/**
 * Cross-type search over the published corpus. `post_search` is a search-only projection of
 * each live post (title, tags, content) behind an FTS5 index; kind, publish state and every
 * field a result shows are read from `posts` and `post_meta`, which stay the source of truth.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OffsetQuery, Page, PaginationError } from "@sdxc/pagination";
import type { Result } from "@sdxc/result";
import type { ParsedQuery, SearchFilter } from "@sdxc/search";
import type { ValidationError } from "@sdxc/validate";
import type { Database, SqlStatement } from "remix/data-table";

import { Pagination } from "@sdxc/pagination";
import { isFailure, success } from "@sdxc/result";
import { defineSearch, parseQuery } from "@sdxc/search";
import { and, inList, rawSql, sql } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import * as schema from "~/database/schema";

/**
 * Type contracts for searching. Type-only, so the runtime logic stays on
 * {@link PostSearch}.
 */
export namespace PostSearch {
	/** The content types a search can reach. */
	export type Kind = "article" | "tutorial" | "glossary" | "bookmark";

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
		/** The public URL of the post, so a caller can cite what it quotes; a bookmark's is the page it saved. */
		url: string;
		/**
		 * The post's summary: an article's or tutorial's excerpt, a glossary entry's definition,
		 * a bookmark's address without its scheme.
		 */
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
		/**
		 * The post's searchable body: Markdown for a post, a glossary entry's definition, a
		 * bookmark's address without its scheme.
		 */
		body: string;
	}
}

/** Every kind a search reaches. */
const KINDS: ReadonlyArray<PostSearch.Kind> = ["article", "tutorial", "glossary", "bookmark"];

/** The `posts.type` each kind is stored as; a bookmark is a `like`. */
const KIND_TYPES: Record<PostSearch.Kind, Post.Type> = {
	article: "article",
	tutorial: "tutorial",
	glossary: "glossary",
	bookmark: "like",
};

/** Where each kind's pages live, used to build a result's public URL; a bookmark links out. */
const KIND_PATHS: Record<Exclude<PostSearch.Kind, "bookmark">, string> = {
	article: "/articles",
	tutorial: "/tutorials",
	glossary: "/glossary",
};

/** The `post_meta` keys a result is read from. */
const RESULT_META_KEYS = ["slug", "title", "term", "excerpt", "definition", "url"];

/**
 * A `posts` date column as epoch milliseconds, read the way `Post.isPublishedAt` reads it: a
 * run of digits is seconds (or milliseconds past 10^12), anything else a date SQLite parses.
 * Text SQLite cannot parse comes out `NULL`, which never compares as published.
 *
 * @param column The column expression, already quoted.
 */
function epochMs(column: string): string {
	return `case
	when ${column} glob '[0-9]*' and ${column} not glob '*[^0-9]*' then
		case when cast(${column} as integer) > 1000000000000
			then cast(${column} as integer)
			else cast(${column} as integer) * 1000 end
	else cast(round((julianday(${column}) - 2440587.5) * 86400000) as integer)
end`;
}

/** `posts.published_at` as epoch milliseconds. */
const PUBLISHED_MS = epochMs(`"posts"."published_at"`);

/** When a post went out: its publish date, or its creation for one published on creation. */
const PUBLICATION_MS = epochMs(`coalesce("posts"."published_at", "posts"."created_at")`);

/** The filter names a query reads, each mapped to the filter it applies; `lang` has aliases. */
const FILTER_NAMES: Record<string, "tag" | "kind" | "lang"> = {
	tag: "tag",
	kind: "kind",
	lang: "lang",
	locale: "lang",
	language: "lang",
};

/** The singular and plural spellings `kind:` accepts. */
const KIND_NAMES: Record<string, PostSearch.Kind> = {
	article: "article",
	articles: "article",
	tutorial: "tutorial",
	tutorials: "tutorial",
	glossary: "glossary",
	glossaries: "glossary",
	bookmark: "bookmark",
	bookmarks: "bookmark",
	like: "bookmark",
	likes: "bookmark",
};

/** Language names `lang:` accepts beside a language tag, read as that tag. */
const LANGUAGE_NAMES: Record<string, string> = {
	english: "en",
	inglés: "en",
	ingles: "en",
	spanish: "es",
	español: "es",
	espanol: "es",
};

/** The language of a post stored without one: the site's own. */
const DEFAULT_LANGUAGE = "en";

/**
 * A projected post's language in lowercase with `-` between subtags: an article's latest
 * `locale`, or the site's language for a post that stores none.
 */
const POST_LANGUAGE = `lower(replace(coalesce((select "post_meta"."value" from "post_meta" where "post_meta"."post_id" = "post_search"."post_id" and "post_meta"."key" = 'locale' order by "post_meta"."updated_at" desc, "post_meta"."created_at" desc limit 1), '${DEFAULT_LANGUAGE}'), '_', '-'))`;

/** The kind a stored `posts.type` is searched as, or `null` for a type search skips. */
function kindOf(type: string): PostSearch.Kind | null {
	return KINDS.find((kind) => KIND_TYPES[kind] === type) ?? null;
}

/**
 * A bookmark's address as it is searched and shown: without its scheme, so its host and path
 * words match while `https` never does.
 */
function addressOf(url: string): string {
	return LikePost.normalizeUrl(url).replace(/^https?:\/\//i, "");
}

/**
 * The search over `post_search`: a title hit outranks a tag hit, which outranks a hit in the
 * body, weighted inside `bm25()` so a body dense with a term can still beat a passing title.
 * `title:` scopes a term to the title.
 */
const POST_SEARCH = defineSearch({
	table: schema.postSearch,
	key: "id",
	columns: [
		{ name: "title", weight: 10, field: "title" },
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
		return parseQuery(text, { fields: POST_SEARCH.fields, filters: Object.keys(FILTER_NAMES) });
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
	 * when the post is deleted, of a kind search skips, or has no title and no content.
	 * Previews are projected too: a search reads publish state from `posts` at query time.
	 *
	 * @param db Database connection used for the read and the write.
	 * @param id The post just created or updated.
	 * @param type The post's stored type, which decides how its metadata is read.
	 */
	static async index(db: Database, id: string, type: Post.Type): Promise<void> {
		let projection = await this.projectionOf(db, id, type);
		if (projection === null || isBlank(projection)) return this.remove(db, id);

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
	 * it, and narrowed by the query's filters and the caller's. A query of filters alone has
	 * no relevance to rank by, so it lists newest first.
	 */
	private static matching(
		db: Database,
		query: ParsedQuery,
		filters: PostSearch.Filters,
	): OffsetQuery<MatchedRow> {
		let conditions = this.conditions(query, filters);
		if (!query.clauses.some((clause) => !clause.exclude)) {
			return new NewestFirst(db, [POST_SEARCH.predicate(query), ...conditions]);
		}

		let found = POST_SEARCH.query(db, query);
		for (let condition of conditions) found = found.where(condition);
		return found;
	}

	/**
	 * What a row must meet beyond the text: published and of a reachable kind, then every
	 * filter. Values of one filter are alternatives; separate filters must all hold.
	 */
	private static conditions(query: ParsedQuery, filters: PostSearch.Filters): Array<SqlStatement> {
		let kinds = new Set<PostSearch.Kind>(filters.kind === undefined ? KINDS : [filters.kind]);
		let conditions: Array<SqlStatement> = [];

		if (filters.tag !== undefined) conditions.push(hasTag([filters.tag], false));

		for (let filter of query.filters) {
			let name = FILTER_NAMES[filter.name];
			if (name === "tag") conditions.push(hasTag(filter.values, filter.exclude));
			if (name === "lang") conditions.push(inLanguage(filter.values, filter.exclude));
			if (name === "kind") kinds = narrowKinds(kinds, filter);
		}

		conditions.unshift(this.published([...kinds], Date.now()));
		return conditions;
	}

	/** The source-table condition a projected row must meet to be returned. */
	private static published(kinds: ReadonlyArray<PostSearch.Kind>, now: number): SqlStatement {
		if (kinds.length === 0) return rawSql("0 = 1");
		let types = kinds.map((kind) => KIND_TYPES[kind]);
		let placeholders = types.map(() => "?").join(", ");
		return rawSql(
			`exists (select 1 from "posts" where "posts"."id" = "post_search"."post_id" and "posts"."deleted_at" is null and "posts"."type" in (${placeholders}) and ("posts"."published_at" is null or (${PUBLISHED_MS}) <= ?))`,
			[...types, now],
		);
	}

	/**
	 * Reads each hit's post back from the source tables in two batched queries, keeping the
	 * search's order. A post deleted between the search and this read is left out, and so is
	 * one with none of the metadata a result shows, which no listing page shows either.
	 */
	private static async hits(
		db: Database,
		rows: ReadonlyArray<MatchedRow>,
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
			let kind = post && post.deleted_at === null ? kindOf(post.type) : null;
			let postMeta = post ? metaByPost.get(post.id) : undefined;
			if (!post || kind === null || postMeta === undefined) return [];
			let result = this.result(kind, post, postMeta, row.tags);
			return [{ ...result, body: row.content }];
		});
	}

	/**
	 * Projects one post into the result shape callers and the MCP tool read: a glossary
	 * entry is titled by its alias or else its term and summarized by its definition, a
	 * bookmark links to the page it saved and has no slug, and tags come from the projection.
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

		let url = kind === "bookmark" ? "" : `${KIND_PATHS[kind]}/${slug}`;
		if (kind === "bookmark") {
			url = LikePost.normalizeUrl(value("url") ?? "");
			excerpt = addressOf(value("url") ?? "");
		}

		return {
			kind,
			title,
			slug,
			url,
			excerpt,
			tags: kind === "tutorial" ? tagsOf(tags) : [],
			publishedAt: Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString(),
		};
	}

	/**
	 * Reads a post through its own type's repository, so the projection carries exactly the
	 * metadata the post's pages show. A glossary entry's title holds its term and its alias,
	 * so either one finds it, and its definition is its content; a bookmark's content is its
	 * address, so a site's name finds what was saved from it.
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

		if (type === "like") {
			let bookmark = await LikePost.findById(db, id);
			if (!bookmark) return null;
			return { title: bookmark.meta.title, tags: [], content: addressOf(bookmark.meta.url) };
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

/** The columns of a matched `post_search` row a result is read back from. */
type MatchedRow = Pick<schema.SelectPostSearch, "id" | "post_id" | "tags" | "content">;

/** `lower(?)` placeholders for each value, for an `in` list compared without case. */
function lowered(values: ReadonlyArray<string>): string {
	return values.map(() => "lower(?)").join(", ");
}

/** Whether the post's projected tags hold any of `values`, compared without case. */
function hasTag(values: ReadonlyArray<string>, exclude: boolean): SqlStatement {
	let tags = values.map((value) => value.trim());
	return rawSql(
		`${exclude ? "not " : ""}exists (select 1 from json_each("post_search"."tags") where lower("value") in (${lowered(tags)}))`,
		tags,
	);
}

/**
 * Whether the post is in any of the languages named, matched on whole subtags: `es` matches
 * `es` and `es-AR`, `es-AR` only `es-AR`. A language's name (`spanish`, `español`) reads as
 * its tag.
 */
function inLanguage(values: ReadonlyArray<string>, exclude: boolean): SqlStatement {
	let tags = values.map((value) => {
		let tag = value.trim().toLowerCase().replaceAll("_", "-");
		return LANGUAGE_NAMES[tag] ?? tag;
	});
	let tests = tags.map(() => `(${POST_LANGUAGE} = ? or ${POST_LANGUAGE} like ? || '-%')`);
	let match = `(${tests.join(" or ")})`;
	return rawSql(
		exclude ? `not ${match}` : match,
		tags.flatMap((tag) => [tag, tag]),
	);
}

/**
 * Narrows the kinds a search reaches by one `kind:` filter: a positive one keeps the kinds it
 * names, an exclusion drops them. A name that is no kind reaches nothing.
 */
function narrowKinds(kinds: Set<PostSearch.Kind>, filter: SearchFilter): Set<PostSearch.Kind> {
	let named = new Set(
		filter.values.flatMap((value) => {
			let kind = KIND_NAMES[value.trim().toLowerCase()];
			return kind === undefined ? [] : [kind];
		}),
	);
	return new Set([...kinds].filter((kind) => named.has(kind) !== filter.exclude));
}

/**
 * The rows matching a query of filters alone, newest publication first, as a page reads
 * them. A query of filters has no relevance to rank by, and the date lives in `posts`, so
 * the statement joins it; ties fall back to the projection's id.
 */
class NewestFirst implements OffsetQuery<MatchedRow> {
	#db: Database;
	#conditions: ReadonlyArray<SqlStatement>;
	#limit: number | null;
	#offset: number;

	constructor(
		db: Database,
		conditions: ReadonlyArray<SqlStatement>,
		limit: number | null = null,
		offset = 0,
	) {
		this.#db = db;
		this.#conditions = conditions;
		this.#limit = limit;
		this.#offset = offset;
	}

	limit(value: number): NewestFirst {
		return new NewestFirst(this.#db, this.#conditions, value, this.#offset);
	}

	offset(value: number): NewestFirst {
		return new NewestFirst(this.#db, this.#conditions, this.#limit, value);
	}

	async count(): Promise<number> {
		let where = this.#where();
		let result = await this.#db.exec(
			rawSql(`select count(*) as "count" from "post_search" where ${where.text}`, where.values),
		);
		return Number(result.rows?.[0]?.count ?? 0);
	}

	async all(): Promise<Array<MatchedRow>> {
		let where = this.#where();
		let window =
			this.#limit === null
				? ""
				: ` limit ${Math.max(0, Math.trunc(this.#limit))} offset ${Math.max(0, Math.trunc(this.#offset))}`;
		let result = await this.#db.exec(
			rawSql(
				`select "post_search"."id", "post_search"."post_id", "post_search"."tags", "post_search"."content" from "post_search" join "posts" on "posts"."id" = "post_search"."post_id" where ${where.text} order by (${PUBLICATION_MS}) desc, "post_search"."id" desc${window}`,
				where.values,
			),
		);
		return (result.rows ?? []) as Array<MatchedRow>;
	}

	/** Every condition joined with `and`, each in parentheses. */
	#where(): SqlStatement {
		return rawSql(
			this.#conditions.map((condition) => `(${condition.text})`).join(" and "),
			this.#conditions.flatMap((condition) => [...condition.values]),
		);
	}
}

/**
 * Whether a projection holds nothing to find or show: no title and no content, as for a post
 * whose metadata was never saved. Such a post stays out of search, as it stays off its listing.
 */
function isBlank(projection: Projection): boolean {
	return projection.title.trim() === "" && projection.content.trim() === "";
}
