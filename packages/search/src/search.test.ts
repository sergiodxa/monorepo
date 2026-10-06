/**
 * Tests for `defineSearch` against both SQLite flavours an app runs on, through the real D1
 * and Durable Object SQL storage adapters over this repo's mocks. The schema is the README's
 * own storage guidance, read from the file, so the documented DDL stays correct.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { KeysetPage } from "@sdxc/pagination";

import { createD1Database, createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Pagination, QueryFailedError } from "@sdxc/pagination";
import { isFailure, unwrap } from "@sdxc/result";
import { column as c, Database, eq, gt, inList, lt, rawSql, sql, table } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { ParsedQuery, ParseQueryOptions } from "./query.js";
import type { ReindexProgress } from "./search.js";

import { ParameterBudgetError, SearchError } from "./errors.js";
import { ARTICLES_SCHEMA } from "./fixtures/schema.js";
import { parseQuery } from "./query.js";
import { defineSearch } from "./search.js";

/** Every `sql` block of the README, which is the storage guidance an app copies. */
const README_DDL = [
	...readFileSync(join(import.meta.dirname, "..", "README.md"), "utf8").matchAll(
		/```sql\n([\s\S]*?)```/g,
	),
]
	.map((block) => block[1] ?? "")
	.join("\n");

let articleTable = table({
	name: "articles",
	columns: {
		id: c.integer().primaryKey(),
		slug: c.text(),
		title: c.text(),
		tags: c.text(),
		summary: c.text().nullable(),
		published_at: c.integer().nullable(),
	},
});

/** The README's definition: a title outranks a tag, and a tag outranks the summary. */
const ARTICLE_SEARCH = defineSearch({
	table: articleTable,
	key: "id",
	columns: [
		{ name: "title", weight: 10 },
		{ name: "tags", weight: 6 },
		{ name: "summary", weight: 1 },
	],
	fts: { table: "articles_fts" },
});

/** The same table searched with `LIKE`, as an app without an index would. */
const ARTICLE_LIKE = defineSearch({
	table: articleTable,
	columns: [
		{ name: "title", weight: 10 },
		{ name: "tags", weight: 6 },
		{ name: "summary", weight: 1 },
	],
});

/** One article the fixtures insert. */
interface ArticleSeed {
	id: number;
	title: string;
	tags?: string;
	summary?: string | null;
	published_at?: number;
}

const ARTICLES: ArticleSeed[] = [
	{ id: 1, title: "Remix route patterns", tags: "remix", summary: "Matching URLs." },
	{ id: 2, title: "Caching at the edge", tags: "remix cache", summary: "Headers and KV." },
	{ id: 3, title: "SQLite on D1", tags: "sqlite", summary: "Remix apps use SQLite too." },
	{ id: 4, title: "It's c++ time", tags: "cpp", summary: "100% of the time, a_b." },
	{ id: 5, title: "Legacy remix forms", tags: "legacy remix", summary: null },
	{ id: 6, title: "Résumé tips", tags: "career", summary: "Write a resume." },
	{ id: 7, title: 'The "AND" operator', tags: "sql", summary: "a:b and OR." },
];

/** Inserts articles, so the README's triggers index them. */
async function insertArticles(db: Database, articles: readonly ArticleSeed[]): Promise<void> {
	for (let article of articles) {
		await db.exec(
			sql`insert into "articles" ("id", "slug", "title", "tags", "summary", "published_at")
				values (${article.id}, ${`article-${article.id}`}, ${article.title}, ${article.tags ?? ""}, ${article.summary ?? null}, ${article.published_at ?? article.id * 1000})`,
		);
	}
}

/** Parses a query the test knows is valid and non-blank. */
function q(input: string, options?: ParseQueryOptions): ParsedQuery {
	let parsed = unwrap(parseQuery(input, options));
	if (parsed === null) throw new Error(`expected terms from ${JSON.stringify(input)}`);
	return parsed;
}

/** Ids of rows, in order. */
function ids(rows: readonly { id: number }[]): number[] {
	return rows.map((row) => row.id);
}

/** Ids of rows, ascending, for assertions on membership rather than order. */
function sortedIds(rows: readonly { id: number }[]): number[] {
	return ids(rows).sort((left, right) => left - right);
}

/** Opens a fresh database through one adapter, with the README's DDL applied. */
type Open = () => Promise<Database>;

const ADAPTERS: [string, Open][] = [
	[
		"D1",
		async () => {
			let db = new Database(createD1DatabaseAdapter(createD1Database()));
			await db.executeScript(README_DDL);
			return db;
		},
	],
	[
		"Durable Object SQL storage",
		async () => {
			let db = new Database(createSQLStorageDatabaseAdapter(createSqlStorage()));
			await db.executeScript(README_DDL);
			return db;
		},
	],
];

describe("the README's storage guidance", () => {
	test("matches the schema the Workers-pool test applies", () => {
		expect(README_DDL.trim()).toBe(ARTICLES_SCHEMA.join("\n\n"));
	});

	test("replays with double-quoted string literals disabled", () => {
		let sqlite = new DatabaseSync(":memory:");
		expect(() => sqlite.exec('select "no_such_column"')).toThrow(/no such column/);
		expect(() => sqlite.exec(README_DDL)).not.toThrow();
		sqlite.close();
	});
});

describe.each(ADAPTERS)("defineSearch over %s", (_name, open) => {
	let db: Database;

	beforeEach(async () => {
		db = await open();
		await insertArticles(db, ARTICLES);
	});

	describe("FTS5", () => {
		test("finds a word and ranks a title hit above a tag and a summary hit", async () => {
			let rows = await ARTICLE_SEARCH.query(db, q("remix")).all();
			expect(sortedIds(rows.slice(0, 2))).toEqual([1, 5]);
			expect(ids(rows)).toContain(2);
			expect(ids(rows).at(-1)).toBe(3);
			expect(rows.every((row) => typeof row.rank === "number" && row.rank < 0)).toBe(true);
		});

		test("matches prefixes by default, and only whole words with prefix: none", async () => {
			expect(ids(await ARTICLE_SEARCH.query(db, q("sql")).all())).toEqual(
				expect.arrayContaining([3, 7]),
			);
			expect(ids(await ARTICLE_SEARCH.query(db, q("sql", { prefix: "none" })).all())).toEqual([7]);
		});

		test("matches a phrase as consecutive words", async () => {
			expect(ids(await ARTICLE_SEARCH.query(db, q(`"route patterns"`)).all())).toEqual([1]);
			expect(ids(await ARTICLE_SEARCH.query(db, q(`"patterns route"`)).all())).toEqual([]);
		});

		test.each([`it's`, `c++`, `AND`, `OR`, `a:b`, `foo"`, `NEAR(x)`, `100%`, `-x remix`])(
			"runs %s as text without a syntax error",
			async (input) => {
				await expect(ARTICLE_SEARCH.query(db, q(input)).all()).resolves.toBeInstanceOf(Array);
			},
		);

		test("finds text holding an apostrophe, a quote and query keywords", async () => {
			expect(ids(await ARTICLE_SEARCH.query(db, q("it's")).all())).toEqual([4]);
			expect(ids(await ARTICLE_SEARCH.query(db, q(`"and" operator`)).all())).toEqual([7]);
		});

		test("leaves out excluded terms", async () => {
			let rows = await ARTICLE_SEARCH.query(db, q("remix -legacy -cache")).all();
			expect(sortedIds(rows)).toEqual([1, 3]);
		});

		test("ignores diacritics", async () => {
			expect(sortedIds(await ARTICLE_SEARCH.query(db, q("resume")).all())).toEqual([6]);
		});

		test("changes the order when the weights change", async () => {
			let summaryFirst = defineSearch({
				table: articleTable,
				columns: [
					{ name: "title", weight: 1 },
					{ name: "tags", weight: 1 },
					{ name: "summary", weight: 50 },
				],
				fts: { table: "articles_fts" },
			});

			expect(ids(await summaryFirst.query(db, q("sqlite")).all())).toEqual([3]);
			let titleFirst = ids(await ARTICLE_SEARCH.query(db, q("remix")).all());
			let summaryLed = ids(await summaryFirst.query(db, q("remix")).all());
			expect(summaryLed[0]).toBe(3);
			expect(titleFirst[0]).not.toBe(3);
		});

		test("ties identical documents on the key", async () => {
			await insertArticles(db, [
				{ id: 20, title: "twin", tags: "", summary: "" },
				{ id: 10, title: "twin", tags: "", summary: "" },
			]);
			expect(ids(await ARTICLE_SEARCH.query(db, q("twin")).all())).toEqual([10, 20]);
		});

		test("filters with a predicate, an object, a fragment and a rank comparison", async () => {
			let base = () => ARTICLE_SEARCH.query(db, q("remix"));

			expect(ids(await base().where(eq("id", 2)).all())).toEqual([2]);
			expect(ids(await base().where({ tags: "legacy remix" }).all())).toEqual([5]);
			expect(
				sortedIds(
					await base()
						.where(inList("id", [1, 3]))
						.all(),
				),
			).toEqual([1, 3]);
			expect(
				sortedIds(
					await base()
						.where(sql`"published_at" > ${2500}`)
						.all(),
				),
			).toEqual([3, 5]);

			let all = await base().all();
			let threshold = all[1]?.rank ?? 0;
			expect(ids(await base().where(lt("rank", threshold)).all())).toEqual(ids(all.slice(0, 1)));
		});

		test("counts matches regardless of the window", async () => {
			expect(await ARTICLE_SEARCH.query(db, q("remix")).limit(1).offset(1).count()).toBe(4);
		});

		test("orders by a caller's ordering instead of rank", async () => {
			let rows = await ARTICLE_SEARCH.query(db, q("remix")).orderBy("published_at", "desc").all();
			expect(ids(rows)).toEqual([5, 3, 2, 1]);
		});

		test("rejects a filter on a column the table lacks", async () => {
			let query = ARTICLE_SEARCH.query(db, q("remix")).where(eq("password" as "id", 1));
			await expect(query.all()).rejects.toBeInstanceOf(SearchError);
		});
	});

	describe("LIKE", () => {
		test("matches substrings and ranks by weighted column hits", async () => {
			let rows = await ARTICLE_LIKE.query(db, q("emi")).all();
			expect(sortedIds(rows.slice(0, 2))).toEqual([1, 5]);
			expect(rows.find((row) => row.id === 1)?.rank).toBe(-16);
			expect(rows.find((row) => row.id === 3)?.rank).toBe(-1);
		});

		test("matches % and _ literally", async () => {
			expect(ids(await ARTICLE_LIKE.query(db, q("100%")).all())).toEqual([4]);
			expect(ids(await ARTICLE_LIKE.query(db, q("a_b")).all())).toEqual([4]);
			expect(ids(await ARTICLE_LIKE.query(db, q("0%")).all())).toEqual([4]);
			expect(ids(await ARTICLE_LIKE.query(db, q("a%b")).all())).toEqual([]);
		});

		test("requires every term, and leaves out excluded terms even beside a NULL column", async () => {
			expect(ids(await ARTICLE_LIKE.query(db, q("remix edge")).all())).toEqual([2]);
			expect(sortedIds(await ARTICLE_LIKE.query(db, q("remix -legacy")).all())).toEqual([1, 2, 3]);
			expect(ids(await ARTICLE_LIKE.query(db, q("forms -absent")).all())).toEqual([5]);
		});

		test("matches a phrase as one substring", async () => {
			expect(ids(await ARTICLE_LIKE.query(db, q(`"route pat"`)).all())).toEqual([1]);
		});

		test("seeks on rank through the result column", async () => {
			let all = await ARTICLE_LIKE.query(db, q("remix")).all();
			let threshold = all[1]?.rank ?? 0;
			let better = await ARTICLE_LIKE.query(db, q("remix")).where(lt("rank", threshold)).all();
			expect(ids(better)).toEqual(ids(all.filter((row) => row.rank < threshold)));
		});

		test("refuses a statement over the parameter budget before running it", async () => {
			let wide = q("a b c d e f g h i j k l m n o p q", { maxTerms: 20 });
			let error = await ARTICLE_LIKE.query(db, wide)
				.all()
				.catch((caught: unknown) => caught);

			expect(error).toBeInstanceOf(ParameterBudgetError);
			expect((error as ParameterBudgetError).count).toBeGreaterThan(100);

			let page = await Pagination.byOffset(ARTICLE_LIKE.query(db, wide), { page: 1, perPage: 5 });
			expect(isFailure(page) && page.error).toBeInstanceOf(QueryFailedError);
		});

		test("fits eight terms over three columns with filters and a seek", async () => {
			let rows = await ARTICLE_LIKE.query(db, q("r e m i x a b c"))
				.where(gt("id", 0))
				.where(lt("rank", 0))
				.all();
			expect(rows).toBeInstanceOf(Array);
		});
	});

	describe("paging", () => {
		beforeEach(async () => {
			let many = Array.from({ length: 23 }, (_, index) => ({
				id: 100 + index,
				title: index % 3 === 0 ? "paging paging" : "paging",
				tags: index % 2 === 0 ? "paging" : "",
				summary: "",
			}));
			await insertArticles(db, many);
		});

		test.each([
			["FTS5", ARTICLE_SEARCH],
			["LIKE", ARTICLE_LIKE],
		])("pages %s by offset with a total", async (_strategy, search) => {
			let seen: number[] = [];
			let first = unwrap(
				await Pagination.byOffset(search.query(db, q("paging")), { page: 1, perPage: 10 }),
			);
			expect(first.pagination.total).toBe(23);
			expect(first.pagination.pages).toBe(3);

			for (let page = 1; page <= 3; page++) {
				let found = unwrap(
					await Pagination.byOffset(search.query(db, q("paging")), { page, perPage: 10 }),
				);
				seen.push(...ids(found.items));
			}

			expect(new Set(seen).size).toBe(23);
			expect(seen).toEqual(ids(await search.query(db, q("paging")).all()));
		});

		test.each([
			["FTS5", ARTICLE_SEARCH],
			["LIKE", ARTICLE_LIKE],
		])("pages %s by keyset over rank and key, forward and back", async (_strategy, search) => {
			let expected = ids(await search.query(db, q("paging")).all());
			let orderBy = [
				["rank", "asc"],
				["id", "asc"],
			] as const;
			let pages: number[][] = [];
			let cursor: string | null = null;

			do {
				let page: KeysetPage<{ id: number }> = unwrap(
					await Pagination.byKeyset(search.query(db, q("paging")), {
						orderBy,
						cursor,
						limit: 7,
					}),
				);
				pages.push(ids(page.items));
				cursor = page.cursors.next;

				if (pages.length === 2) {
					let back = unwrap(
						await Pagination.byKeyset(search.query(db, q("paging")), {
							orderBy,
							cursor: page.cursors.prev,
							limit: 7,
						}),
					);
					expect(ids(back.items)).toEqual(pages[0]);
				}
			} while (cursor !== null);

			expect(pages.flat()).toEqual(expected);
		});

		test("pages a search by a stable order, exactly as any list", async () => {
			let pages: number[] = [];
			let cursor: string | null = null;

			do {
				let page: KeysetPage<{ id: number }> = unwrap(
					await Pagination.byKeyset(ARTICLE_SEARCH.query(db, q("paging")), {
						orderBy: [
							["published_at", "desc"],
							["id", "desc"],
						],
						cursor,
						limit: 5,
					}),
				);
				pages.push(...ids(page.items));
				cursor = page.cursors.next;
			} while (cursor !== null);

			expect(pages).toEqual(Array.from({ length: 23 }, (_, index) => 122 - index));
		});
	});

	describe("predicate", () => {
		test.each([
			["FTS5", ARTICLE_SEARCH],
			["LIKE", ARTICLE_LIKE],
		])("embeds the %s match in a statement the app writes", async (_strategy, search) => {
			let match = search.predicate(q("remix -legacy"), { alias: "p" });
			let { rows = [] } = await db.exec(
				sql`select p."id" from "articles" p where ${match} order by p."id"`,
			);
			expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);
		});
	});

	describe("reindex", () => {
		/** Empties the index, as a recreated table after an export starts. */
		async function emptyIndex(): Promise<void> {
			await db.exec(rawSql(`insert into "articles_fts" ("articles_fts") values ('delete-all')`));
			expect(await ARTICLE_SEARCH.query(db, q("remix")).count()).toBe(0);
		}

		/** Runs `integrity-check`, which fails on a corrupted index. */
		async function checkIntegrity(): Promise<void> {
			await db.exec(
				rawSql(`insert into "articles_fts" ("articles_fts") values ('integrity-check')`),
			);
		}

		test("fills an empty index in batches", async () => {
			await emptyIndex();

			let after: number | null = null;
			let batches = 0;
			do {
				let progress: ReindexProgress = unwrap(
					await ARTICLE_SEARCH.reindex(db, { after, limit: 3 }),
				);
				after = progress.next;
				batches++;
			} while (after !== null);

			expect(batches).toBe(3);
			expect(await ARTICLE_SEARCH.query(db, q("remix")).count()).toBe(4);
			await checkIntegrity();
		});

		test("survives an interrupted and repeated batch", async () => {
			await emptyIndex();

			let first = unwrap(await ARTICLE_SEARCH.reindex(db, { limit: 4 }));
			expect(first).toEqual({ indexed: 4, next: 4 });
			expect(unwrap(await ARTICLE_SEARCH.reindex(db, { limit: 4 }))).toEqual(first);
			expect(unwrap(await ARTICLE_SEARCH.reindex(db, { after: 4, limit: 4 }))).toEqual({
				indexed: 3,
				next: null,
			});
			expect(unwrap(await ARTICLE_SEARCH.reindex(db, { after: 4, limit: 4 }))).toEqual({
				indexed: 3,
				next: null,
			});

			expect(sortedIds(await ARTICLE_SEARCH.query(db, q("remix")).all())).toEqual([1, 2, 3, 5]);
			await checkIntegrity();
		});

		test("stays correct when trigger writes race a batch", async () => {
			await emptyIndex();
			unwrap(await ARTICLE_SEARCH.reindex(db, { limit: 3 }));

			await db.exec(sql`update "articles" set "title" = ${"Remix renamed"} where "id" = ${2}`);
			await db.exec(sql`update "articles" set "title" = ${"Gone"} where "id" = ${5}`);
			await db.exec(sql`delete from "articles" where "id" = ${1}`);
			await db.exec(sql`delete from "articles" where "id" = ${6}`);
			await insertArticles(db, [{ id: 8, title: "Remix newcomer" }]);

			let progress = unwrap(await ARTICLE_SEARCH.reindex(db, { after: 3, limit: 10 }));
			expect(progress.next).toBeNull();

			expect(sortedIds(await ARTICLE_SEARCH.query(db, q("remix")).all())).toEqual([2, 3, 5, 8]);
			expect(ids(await ARTICLE_SEARCH.query(db, q("renamed")).all())).toEqual([2]);
			expect(ids(await ARTICLE_SEARCH.query(db, q("resume")).all())).toEqual([]);
			await checkIntegrity();
		});

		test("answers a failure for a search with no FTS5 table", async () => {
			let progress = await ARTICLE_LIKE.reindex(db);
			expect(isFailure(progress) && progress.error).toBeInstanceOf(SearchError);
		});
	});

	describe("the recommended triggers", () => {
		/** Runs `integrity-check`, which fails on a corrupted index. */
		async function checkIntegrity(): Promise<void> {
			await db.exec(
				rawSql(`insert into "articles_fts" ("articles_fts") values ('integrity-check')`),
			);
		}

		test("replace a row's terms when an upsert rewrites it", async () => {
			await db.exec(
				sql`insert into "articles" ("slug", "title", "tags", "summary")
					values (${"article-1"}, ${"Streaming responses"}, ${""}, ${null})
					on conflict ("slug") do update set "title" = excluded."title", "tags" = excluded."tags", "summary" = excluded."summary"`,
			);

			expect(ids(await ARTICLE_SEARCH.query(db, q("patterns")).all())).toEqual([]);
			expect(ids(await ARTICLE_SEARCH.query(db, q("streaming")).all())).toEqual([1]);
			await checkIntegrity();
		});

		test("replace a row's terms when the source row is replaced", async () => {
			await db.exec(
				sql`insert or replace into "articles" ("id", "slug", "title", "tags", "summary")
					values (${1}, ${"article-1"}, ${"Streaming responses"}, ${""}, ${null})`,
			);

			expect(ids(await ARTICLE_SEARCH.query(db, q("patterns")).all())).toEqual([]);
			expect(ids(await ARTICLE_SEARCH.query(db, q("streaming")).all())).toEqual([1]);
			await checkIntegrity();
		});
	});
});

describe("defineSearch with a trigram index", () => {
	let db: Database;

	let notes = table({
		name: "notes",
		columns: { id: c.integer().primaryKey(), body: c.text() },
	});

	const NOTE_SEARCH = defineSearch({
		table: notes,
		columns: [{ name: "body", weight: 1 }],
		fts: { table: "notes_fts", tokenizer: "trigram" },
	});

	beforeEach(async () => {
		db = new Database(createD1DatabaseAdapter(createD1Database()));
		await db.executeScript(`
			CREATE TABLE "notes" ("id" INTEGER PRIMARY KEY, "body" TEXT NOT NULL);
			CREATE VIRTUAL TABLE "notes_fts" USING fts5("body", content='', contentless_delete=1, tokenize='trigram');
			CREATE TRIGGER "notes_fts_insert" AFTER INSERT ON "notes" BEGIN
				INSERT OR REPLACE INTO "notes_fts" ("rowid", "body") VALUES (new."id", new."body");
			END;
		`);
		await db.exec(sql`insert into "notes" ("id", "body") values (1, ${"PostgreSQL tuning"})`);
		await db.exec(sql`insert into "notes" ("id", "body") values (2, ${"Go 1.22 notes"})`);
	});

	test("matches a substring of three characters or more through the index", async () => {
		expect(ids(await NOTE_SEARCH.query(db, q("gres")).all())).toEqual([1]);
	});

	test("answers a shorter term with LIKE, which the index cannot", async () => {
		expect(ids(await NOTE_SEARCH.query(db, q("go")).all())).toEqual([2]);
	});
});

describe("defineSearch with JSON and boolean columns", () => {
	let items = table({
		name: "items",
		columns: {
			id: c.text().primaryKey(),
			title: c.text(),
			meta: c.json(),
			starred: c.boolean(),
		},
	});

	const ITEM_SEARCH = defineSearch({ table: items, columns: [{ name: "title", weight: 1 }] });

	test("decodes rows as the table declares them, and binds booleans as integers", async () => {
		let db = new Database(createD1DatabaseAdapter(createD1Database()));
		await db.executeScript(
			`CREATE TABLE "items" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "meta" TEXT, "starred" INTEGER NOT NULL);`,
		);
		await db.create(items, { id: "a", title: "Remix", meta: { tags: ["x"] }, starred: true });
		await db.create(items, { id: "b", title: "Remix too", meta: null, starred: false });

		let rows = await ITEM_SEARCH.query(db, q("remix")).where({ starred: true }).all();
		expect(rows).toEqual([
			{ id: "a", title: "Remix", meta: { tags: ["x"] }, starred: true, rank: -1 },
		]);
	});
});

describe("defineSearch validation", () => {
	let posts = table({
		name: "posts",
		columns: { id: c.integer().primaryKey(), slug: c.text(), title: c.text() },
	});

	test.each([
		["empty columns", { table: posts, columns: [] }],
		["a zero weight", { table: posts, columns: [{ name: "title", weight: 0 }] }],
		["a NaN weight", { table: posts, columns: [{ name: "title", weight: Number.NaN }] }],
		["an unknown column", { table: posts, columns: [{ name: "body", weight: 1 }] }],
		[
			"a duplicated column",
			{
				table: posts,
				columns: [
					{ name: "title", weight: 1 },
					{ name: "title", weight: 2 },
				],
			},
		],
		[
			"a text key with fts",
			{ table: posts, key: "slug", columns: [{ name: "title", weight: 1 }], fts: { table: "f" } },
		],
	])("throws a RangeError for %s", (_case, options) => {
		expect(() => defineSearch(options as Parameters<typeof defineSearch>[0])).toThrow(RangeError);
	});

	test("throws for a table that declares a rank column", () => {
		let ranked = table({
			name: "ranked",
			columns: { id: c.integer().primaryKey(), rank: c.integer() },
		});
		expect(() => defineSearch({ table: ranked, columns: [{ name: "id", weight: 1 }] })).toThrow(
			RangeError,
		);
	});

	test("throws for a composite primary key without a key", () => {
		let pairs = table({
			name: "pairs",
			columns: { a: c.integer(), b: c.integer(), title: c.text() },
			primaryKey: ["a", "b"],
		});
		expect(() => defineSearch({ table: pairs, columns: [{ name: "title", weight: 1 }] })).toThrow(
			RangeError,
		);
		expect(() =>
			defineSearch({ table: pairs, key: "a", columns: [{ name: "title", weight: 1 }] }),
		).not.toThrow();
	});

	test("freezes the definition", () => {
		expect(Object.isFrozen(ARTICLE_SEARCH)).toBe(true);
	});
});
