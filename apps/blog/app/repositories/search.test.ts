/**
 * Tests post search against a migrated in-memory D1: the migration backfills the search
 * projection of existing posts, every post write keeps it current, and queries rank, filter
 * and page published posts only, reading what a result shows from the source tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { succeeded } from "@sdxc/result";
import { Database, sql } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { testDatabase } from "~/app/test/database";
import { applyMigrations, seedAuthor } from "~/app/test/fixtures";

import { PostSearch } from "./search";

/** The migration that creates and backfills the search projection. */
const SEARCH_MIGRATION = "0006_PostSearch.sql";

/** The migration that adds bookmarks to the search projection. */
const BOOKMARK_MIGRATION = "0007_BookmarkSearch.sql";

/** The migration that drops search rows with nothing to find. */
const BLANK_MIGRATION = "0008_DropBlankSearchRows.sql";

/** A publish date safely in the past. */
const PAST = "2026-01-15T10:00:00.000Z";

/** A publish date safely in the future, which makes a post a preview. */
const FUTURE = "2099-01-01T00:00:00.000Z";

let db: Database;
let author: string;

/** The `post_search` rows, by post id. */
async function projections(database: Database) {
	let result = await database.exec(
		sql`select "post_id", "title", "tags", "content" from "post_search" order by "post_id"`,
	);
	return result.rows ?? [];
}

/** The slugs a search returns, in order. */
async function slugsFor(options: PostSearch.Options) {
	let results = await PostSearch.query(db, options);
	return results.map((result) => result.slug);
}

/** Creates an article, published in the past unless told otherwise. */
function article(input: {
	slug: string;
	title: string;
	content?: string;
	excerpt?: string;
	published_at?: string | null;
}) {
	return ArticlePost.create(db, {
		author_id: author,
		published_at: input.published_at === undefined ? PAST : input.published_at,
		meta: {
			slug: input.slug,
			title: input.title,
			locale: "en",
			content: input.content ?? "Body",
			excerpt: input.excerpt,
		},
	});
}

beforeEach(async () => {
	db = await testDatabase();
	author = await seedAuthor(db);
});

describe("the 0006 migration", () => {
	test("backfills the searchable text of every live post, and indexes it", async () => {
		let binding = createD1Database();
		await applyMigrations(binding, (file) => file < SEARCH_MIGRATION);
		let legacy = new Database(createD1DatabaseAdapter(binding));
		let user = await seedAuthor(legacy);

		await binding
			.prepare(
				`INSERT INTO posts (id, type, author_id, published_at, created_at, updated_at, deleted_at) VALUES
				('a1', 'article', '${user}', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL),
				('t1', 'tutorial', '${user}', '${FUTURE}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL),
				('g1', 'glossary', '${user}', NULL, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z', NULL),
				('n1', 'tutorial', '${user}', '1700000000', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL),
				('gone', 'article', '${user}', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
				('like', 'like', '${user}', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL)`,
			)
			.run();

		await binding
			.prepare(
				`INSERT INTO post_meta (id, post_id, key, value, created_at, updated_at) VALUES
				('m1', 'a1', 'title', 'Old title', '2026-01-01', '2026-01-01'),
				('m2', 'a1', 'title', 'Remix routing', '2026-01-01', '2026-01-03'),
				('m3', 'a1', 'slug', 'remix-routing', '2026-01-01', '2026-01-01'),
				('m4', 'a1', 'excerpt', 'How routes match', '2026-01-01', '2026-01-01'),
				('m5', 'a1', 'content', 'Patterns decide which handler runs.', '2026-01-01', '2026-01-01'),
				('m6', 't1', 'title', 'Scheduled', '2026-01-01', '2026-01-01'),
				('m7', 't1', 'slug', 'scheduled', '2026-01-01', '2026-01-01'),
				('m8', 't1', 'tags', '["remix", " remix ", 1, "react router"]', '2026-01-01', '2026-01-01'),
				('m9', 'g1', 'term', 'FTS', '2026-01-01', '2026-01-01'),
				('m10', 'g1', 'title', 'Full-text search', '2026-01-01', '2026-01-01'),
				('m11', 'g1', 'slug', 'fts', '2026-01-01', '2026-01-01'),
				('m12', 'g1', 'definition', 'An index of words', '2026-01-01', '2026-01-01'),
				('m13', 'n1', 'title', 'Legacy', '2026-01-01', '2026-01-01'),
				('m14', 'n1', 'slug', 'legacy', '2026-01-01', '2026-01-01'),
				('m15', 'n1', 'tags', 'plain', '2026-01-01', '2026-01-01')`,
			)
			.run();

		await applyMigrations(binding, (file) => file === SEARCH_MIGRATION);

		expect(await projections(legacy)).toEqual([
			{
				post_id: "a1",
				title: "Remix routing",
				tags: "[]",
				content: "Patterns decide which handler runs.",
			},
			{ post_id: "g1", title: "FTS Full-text search", tags: "[]", content: "An index of words" },
			{ post_id: "n1", title: "Legacy", tags: '["plain"]', content: "" },
			{ post_id: "t1", title: "Scheduled", tags: '["remix","react router"]', content: "" },
		]);

		expect((await PostSearch.query(legacy, { query: "handler" })).map((hit) => hit.slug)).toEqual([
			"remix-routing",
		]);
		expect(await PostSearch.query(legacy, { query: "fts" })).toEqual([
			{
				kind: "glossary",
				title: "Full-text search",
				slug: "fts",
				url: "/glossary/fts",
				excerpt: "An index of words",
				tags: [],
				publishedAt: "2026-01-02T00:00:00.000Z",
			},
		]);
		expect(
			(await PostSearch.query(legacy, { query: "legacy" })).map((hit) => hit.publishedAt),
		).toEqual(["2023-11-14T22:13:20.000Z"]);
		expect(await PostSearch.query(legacy, { query: "scheduled" })).toEqual([]);
	});
});

describe("the 0007 migration", () => {
	test("backfills every live bookmark by its title and scheme-less address, leaving other rows alone", async () => {
		let binding = createD1Database();
		await applyMigrations(binding, (file) => file < BOOKMARK_MIGRATION);
		let legacy = new Database(createD1DatabaseAdapter(binding));
		let user = await seedAuthor(legacy);
		let saved = await LikePost.create(legacy, {
			author_id: user,
			meta: { title: "Already indexed", url: "https://example.com/kept" },
		});
		await legacy.exec(
			sql`update "post_search" set "content" = 'as written' where "post_id" = ${saved!.id}`,
		);

		await binding
			.prepare(
				`INSERT INTO posts (id, type, author_id, published_at, created_at, updated_at, deleted_at) VALUES
				('b1', 'like', '${user}', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL),
				('b2', 'like', '${user}', NULL, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z', NULL),
				('b3', 'like', '${user}', NULL, '2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z', '2026-02-01T00:00:00.000Z')`,
			)
			.run();
		await binding
			.prepare(
				`INSERT INTO post_meta (id, post_id, key, value, created_at, updated_at) VALUES
				('l1', 'b1', 'title', 'Old title', '2026-01-01', '2026-01-01'),
				('l2', 'b1', 'title', 'Remix v3 is here', '2026-01-01', '2026-01-03'),
				('l3', 'b1', 'url', 'https://remix.run/blog/remix-v3', '2026-01-01', '2026-01-01'),
				('l4', 'b2', 'title', 'A bare host', '2026-01-02', '2026-01-02'),
				('l5', 'b2', 'url', 'example.org/notes', '2026-01-02', '2026-01-02'),
				('l6', 'b3', 'title', 'Deleted', '2026-01-03', '2026-01-03')`,
			)
			.run();

		await applyMigrations(binding, (file) => file === BOOKMARK_MIGRATION);

		expect(await projections(legacy)).toEqual(
			[
				{ post_id: saved!.id, title: "Already indexed", tags: "[]", content: "as written" },
				{
					post_id: "b1",
					title: "Remix v3 is here",
					tags: "[]",
					content: "remix.run/blog/remix-v3",
				},
				{ post_id: "b2", title: "A bare host", tags: "[]", content: "example.org/notes" },
			].sort((a, b) => a.post_id.localeCompare(b.post_id)),
		);
		expect(await PostSearch.query(legacy, { query: "remix.run" })).toEqual([
			{
				kind: "bookmark",
				title: "Remix v3 is here",
				slug: "",
				url: "https://remix.run/blog/remix-v3",
				excerpt: "remix.run/blog/remix-v3",
				tags: [],
				publishedAt: "2026-01-01T00:00:00.000Z",
			},
		]);
	});
});

describe("the 0008 migration", () => {
	test("drops the rows of posts with no metadata or no text, keeping every real one", async () => {
		let binding = createD1Database();
		await applyMigrations(binding, (file) => file < BLANK_MIGRATION);
		let legacy = new Database(createD1DatabaseAdapter(binding));
		let user = await seedAuthor(legacy);
		let real = await LikePost.create(legacy, {
			author_id: user,
			meta: { title: "A real bookmark", url: "https://example.com" },
		});

		await binding
			.prepare(
				`INSERT INTO posts (id, type, author_id, published_at, created_at, updated_at, deleted_at) VALUES
				('orphan', 'like', '${user}', NULL, '2026-08-06T00:00:00.000Z', '2026-08-06T00:00:00.000Z', NULL),
				('blank', 'article', '${user}', NULL, '2026-08-06T00:00:00.000Z', '2026-08-06T00:00:00.000Z', NULL)`,
			)
			.run();
		await binding
			.prepare(
				`INSERT INTO post_meta (id, post_id, key, value, created_at, updated_at) VALUES
				('bm', 'blank', 'slug', 'blank', '2026-08-06', '2026-08-06')`,
			)
			.run();
		await binding
			.prepare(
				`INSERT INTO post_search (post_id, title, tags, content) VALUES
				('orphan', '', '[]', ''), ('blank', '  ', '[]', ' ')`,
			)
			.run();

		await applyMigrations(binding, (file) => file === BLANK_MIGRATION);

		expect((await projections(legacy)).map((row) => row.post_id)).toEqual([real!.id]);
		expect(await PostSearch.query(legacy, { query: "kind:bookmarks" })).toHaveLength(1);
	});
});

describe("keeping post_search current", () => {
	test("never indexes a post with no title and no content, such as one whose metadata was never saved", async () => {
		let created = await LikePost.create(db, { author_id: author, meta: { title: "", url: "" } });
		expect(await projections(db)).toEqual([]);

		await LikePost.update(db, created!.id, { meta: { title: "Now it has a title" } });
		expect((await projections(db)).map((row) => row.post_id)).toEqual([created!.id]);

		await LikePost.update(db, created!.id, { meta: { title: "  " } });
		expect(await projections(db)).toEqual([]);
	});

	test("an orphan bookmark with no metadata never shows up as a result, even with a stale row", async () => {
		let orphan = await LikePost.create(db, { author_id: author, meta: {} as LikePost.Meta });
		await db.exec(
			sql`insert into "post_search" ("post_id", "title", "tags", "content") values (${orphan!.id}, '', '[]', '') on conflict ("post_id") do nothing`,
		);
		let real = await LikePost.create(db, {
			author_id: author,
			meta: { title: "Render JSX to images", url: "https://example.com/jsx" },
		});

		let results = await PostSearch.query(db, { query: "kind:bookmarks" });
		expect(results.map((result) => result.url)).toEqual(["https://example.com/jsx"]);
		expect(real).not.toBeNull();
	});

	test("a bookmark is searchable by its title and its site, follows edits and leaves on delete", async () => {
		let created = await LikePost.create(db, {
			author_id: author,
			meta: { title: "Remix v3 is here", url: "https://remix.run/blog/remix-v3" },
		});
		let id = created!.id;
		let urls = async (query: string) =>
			(await PostSearch.query(db, { query })).map((result) => result.url);

		expect(await projections(db)).toEqual([
			{ post_id: id, title: "Remix v3 is here", tags: "[]", content: "remix.run/blog/remix-v3" },
		]);
		expect(await urls("remix")).toEqual(["https://remix.run/blog/remix-v3"]);
		expect(await urls("blog")).toEqual(["https://remix.run/blog/remix-v3"]);
		expect(await urls("https")).toEqual([]);

		await LikePost.update(db, id, {
			meta: { title: "Streaming in Workers", url: "developers.cloudflare.com/workers" },
		});
		expect(await urls("remix")).toEqual([]);
		expect(await urls("cloudflare")).toEqual(["https://developers.cloudflare.com/workers"]);

		await LikePost.destroy(db, id);
		expect(await urls("cloudflare")).toEqual([]);
		expect(await projections(db)).toEqual([]);
	});

	test("a created post is searchable, an edit replaces what it matches, and a delete removes it", async () => {
		let created = await article({ slug: "first", title: "Caching at the edge" });
		let id = created!.id;
		expect(await slugsFor({ query: "caching" })).toEqual(["first"]);

		await ArticlePost.update(db, id, { meta: { title: "Streaming responses" } });
		expect(await slugsFor({ query: "caching" })).toEqual([]);
		expect(await slugsFor({ query: "streaming" })).toEqual(["first"]);

		await ArticlePost.destroy(db, id);
		expect(await slugsFor({ query: "streaming" })).toEqual([]);
		expect(await projections(db)).toEqual([]);
	});

	test("holds only the searchable text, keeping previews projected and out of results", async () => {
		let created = await article({ slug: "later", title: "Edge rendering", content: "Body text" });
		expect(await projections(db)).toEqual([
			{ post_id: created!.id, title: "Edge rendering", tags: "[]", content: "Body text" },
		]);
		expect(await slugsFor({ query: "edge" })).toEqual(["later"]);

		await ArticlePost.update(db, created!.id, { published_at: FUTURE });
		expect(await slugsFor({ query: "edge" })).toEqual([]);
		expect(await projections(db)).toHaveLength(1);
	});

	test("a glossary entry is found by its term or its alias, and leaves on delete", async () => {
		let entry = await GlossaryPost.create(db, {
			author_id: author,
			meta: {
				slug: "ssr",
				term: "SSR",
				title: "Server rendering",
				definition: "HTML built per request",
			},
		});

		expect(await slugsFor({ query: "ssr" })).toEqual(["ssr"]);
		let [hit] = await PostSearch.query(db, { query: "server" });
		expect(hit).toMatchObject({
			kind: "glossary",
			title: "Server rendering",
			excerpt: "HTML built per request",
			url: "/glossary/ssr",
		});

		await GlossaryPost.destroy(db, entry!.id);
		expect(await PostSearch.query(db, { query: "request" })).toEqual([]);
	});
});

describe("PostSearch.query", () => {
	beforeEach(async () => {
		await article({ slug: "mentions", title: "Building forms", content: "Mentions Remix once." });
		await article({ slug: "about", title: "Remix forms", content: "All about forms." });
		await TutorialPost.create(db, {
			author_id: author,
			published_at: PAST,
			meta: {
				slug: "tagged",
				title: "Progressive enhancement",
				excerpt: "Forms that work without JavaScript",
				content: "Forms submit natively.",
				tags: ["Remix", "HTML"],
			},
		});
		await article({ slug: "draft", title: "Remix preview", published_at: FUTURE });
	});

	test("ranks a title match above a tag match above a body match, and skips previews", async () => {
		expect(await slugsFor({ query: "remix" })).toEqual(["about", "tagged", "mentions"]);
	});

	test("narrows by kind and by tag, comparing tags without case", async () => {
		expect(await slugsFor({ query: "forms", kind: "tutorial" })).toEqual(["tagged"]);
		expect(await slugsFor({ query: "forms", tag: "html" })).toEqual(["tagged"]);
		expect(await slugsFor({ query: "forms", tag: "rails" })).toEqual([]);
	});

	test("honours the limit", async () => {
		expect(await slugsFor({ query: "remix", limit: 1 })).toEqual(["about"]);
		expect(await slugsFor({ query: "remix", limit: 0 })).toEqual([]);
	});

	test("answers nothing for a blank query or one holding nothing to find", async () => {
		expect(await slugsFor({ query: "   " })).toEqual([]);
		expect(await slugsFor({ query: "-remix" })).toEqual([]);
		expect(await slugsFor({ query: "+++" })).toEqual([]);
	});

	test("reads punctuation and query syntax as plain words", async () => {
		let slugs = await slugsFor({ query: `remix" (forms -"c++"` });
		expect([...slugs].sort()).toEqual(["about", "mentions", "tagged"]);
	});

	test("keeps the result shape the MCP tool returns, read from the source tables", async () => {
		let [hit] = await PostSearch.query(db, { query: "progressive" });

		expect(hit).toEqual({
			kind: "tutorial",
			title: "Progressive enhancement",
			slug: "tagged",
			url: "/tutorials/tagged",
			excerpt: "Forms that work without JavaScript",
			tags: ["Remix", "HTML"],
			publishedAt: PAST,
		});
	});
});

describe("PostSearch.page", () => {
	test("pages published matches with a total", async () => {
		for (let index = 1; index <= 5; index++) {
			await article({ slug: `post-${index}`, title: `Search part ${index}` });
		}
		await article({ slug: "hidden", title: "Search preview", published_at: FUTURE });

		let parsed = PostSearch.parse("search");
		succeeded(parsed);
		let query = parsed.data!;

		let first = await PostSearch.page(db, { query, page: 1, perPage: 2 });
		succeeded(first);
		expect(first.data.pagination.total).toBe(5);
		expect(first.data.pagination.pages).toBe(3);
		expect(first.data.items).toHaveLength(2);

		let last = await PostSearch.page(db, { query, page: 3, perPage: 2 });
		succeeded(last);
		expect(last.data.items).toHaveLength(1);

		let seen = [...first.data.items, ...last.data.items].map((item) => item.slug);
		expect(seen).not.toContain("hidden");
	});
});
