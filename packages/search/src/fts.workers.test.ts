/**
 * Runs the recommended FTS5 schema and a search end to end inside workerd, against a real
 * D1 binding, which is what keeps the README's claims checked: the DDL applies, a
 * contentless-delete table accepts the triggers' writes, and the statements run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Pagination } from "@sdxc/pagination";
import { unwrap } from "@sdxc/result";
import { env, reset } from "cloudflare:test";
import { column as c, Database, rawSql, sql, table } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { ARTICLES_SCHEMA } from "../test/schema.js";

import type { ParsedQuery } from "./query.js";

import { parseQuery } from "./query.js";
import { defineSearch } from "./search.js";

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

const ARTICLE_SEARCH = defineSearch({
	table: articleTable,
	columns: [
		{ name: "title", weight: 10 },
		{ name: "tags", weight: 6 },
		{ name: "summary", weight: 1 },
	],
	fts: { table: "articles_fts" },
});

/** Parses a query the test knows is valid and non-blank. */
function q(input: string): ParsedQuery {
	let parsed = unwrap(parseQuery(input));
	if (parsed === null) throw new Error(`expected terms from ${JSON.stringify(input)}`);
	return parsed;
}

/** Inserts one article, so the triggers index it. */
async function insert(db: Database, id: number, title: string, summary: string): Promise<void> {
	await db.exec(
		sql`insert into "articles" ("id", "slug", "title", "tags", "summary", "published_at")
			values (${id}, ${`article-${id}`}, ${title}, ${""}, ${summary}, ${id})`,
	);
}

describe("the recommended FTS5 schema on D1", () => {
	let db: Database;

	beforeEach(async () => {
		await reset();
		await env.DB.batch(ARTICLES_SCHEMA.map((statement) => env.DB.prepare(statement)));
		db = new Database(createD1DatabaseAdapter(env.DB));

		await insert(db, 1, "Remix route patterns", "Matching URLs.");
		await insert(db, 2, "It's c++ time", "Remix at the edge.");
		await insert(db, 3, "Résumé tips", "Write a resume.");
	});

	test("searches, ranks and pages through the triggers' index", async () => {
		let page = unwrap(
			await Pagination.byOffset(ARTICLE_SEARCH.query(db, q("remix")), { page: 1, perPage: 10 }),
		);
		expect(page.items.map((row) => row.id)).toEqual([1, 2]);
		expect(page.pagination.total).toBe(2);

		expect((await ARTICLE_SEARCH.query(db, q("it's c++")).all()).map((row) => row.id)).toEqual([2]);
		expect((await ARTICLE_SEARCH.query(db, q("resume")).all()).map((row) => row.id)).toEqual([3]);
	});

	test("replaces a row's terms when an upsert rewrites it", async () => {
		await db.exec(
			sql`insert into "articles" ("slug", "title", "tags", "summary")
				values (${"article-1"}, ${"Streaming responses"}, ${""}, ${null})
				on conflict ("slug") do update set "title" = excluded."title", "summary" = excluded."summary"`,
		);

		expect((await ARTICLE_SEARCH.query(db, q("patterns")).all()).map((row) => row.id)).toEqual([]);
		expect((await ARTICLE_SEARCH.query(db, q("streaming")).all()).map((row) => row.id)).toEqual([
			1,
		]);
		await db.exec(rawSql(`insert into "articles_fts" ("articles_fts") values ('integrity-check')`));
	});

	test("keeps the contentless-delete index correct through updates, deletes and reindexing", async () => {
		await db.exec(sql`update "articles" set "title" = ${"Renamed"} where "id" = ${1}`);
		await db.exec(sql`delete from "articles" where "id" = ${2}`);
		expect((await ARTICLE_SEARCH.query(db, q("remix")).all()).map((row) => row.id)).toEqual([]);

		await db.exec(rawSql(`insert into "articles_fts" ("articles_fts") values ('delete-all')`));
		expect(unwrap(await ARTICLE_SEARCH.reindex(db, { limit: 2 }))).toEqual({ indexed: 2, next: 3 });
		expect(unwrap(await ARTICLE_SEARCH.reindex(db, { after: 3, limit: 2 }))).toEqual({
			indexed: 0,
			next: null,
		});

		expect((await ARTICLE_SEARCH.query(db, q("renamed")).all()).map((row) => row.id)).toEqual([1]);
		await db.exec(rawSql(`insert into "articles_fts" ("articles_fts") values ('integrity-check')`));
	});
});
