/**
 * Verifies the schema against a real SQLite database: that migrating is repeatable,
 * that every index exists, and — the assertion that matters most — that both paging
 * queries are answered from an index instead of sorting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { beforeEach, describe, expect, test } from "vitest";

import { runMigrations } from "./migrations";

let sql: ReturnType<typeof createSqlStorage>;

beforeEach(() => {
	sql = createSqlStorage();
});

/** Applies every migration and hands back the storage they were applied to. */
async function migrate() {
	let applied = await runMigrations(createSQLStorageDatabaseAdapter(sql));
	return applied;
}

/** Reads a query plan as one string, which is what the index assertions match on. */
function queryPlan(query: string): string {
	return [...sql.exec<{ detail: string }>(`EXPLAIN QUERY PLAN ${query}`)]
		.map((row) => row.detail)
		.join(" | ");
}

describe("runMigrations", () => {
	test("applies the initial migration", async () => {
		expect((await migrate()).applied).toEqual(["0001-init"]);
	});

	test("does nothing on a database already migrated", async () => {
		await migrate();
		expect((await migrate()).applied).toEqual([]);
	});

	test("creates every table and index the schema declares", async () => {
		await migrate();

		let names = [
			...sql.exec<{ name: string }>(
				`SELECT name FROM sqlite_master WHERE type IN ('table', 'index')`,
			),
		]
			.map((row) => row.name)
			.sort();

		for (let name of [
			"settings",
			"feeds",
			"feed_items",
			"reader_migrations",
			"feeds_feed_url_idx",
			"feed_items_feed_guid_idx",
			"feed_items_timeline_idx",
			"feed_items_feed_timeline_idx",
			"feed_items_unread_timeline_idx",
		]) {
			expect(names, `${name} exists`).toContain(name);
		}
	});
});

describe("schema constraints", () => {
	test("refuses a refresh interval outside the offered cadences", async () => {
		await migrate();
		let insert = (hours: number) =>
			sql.exec(
				`INSERT INTO settings (id, subject, refresh_interval_hours, created_at, updated_at)
				 VALUES (1, 's', ?, 0, 0)`,
				hours,
			);

		expect(() => insert(2)).toThrow();
		expect(() => insert(6)).not.toThrow();
	});

	test("refuses a second row in settings", async () => {
		await migrate();
		sql.exec(`INSERT INTO settings (id, subject, created_at, updated_at) VALUES (1, 's', 0, 0)`);

		expect(() =>
			sql.exec(`INSERT INTO settings (id, subject, created_at, updated_at) VALUES (2, 's', 0, 0)`),
		).toThrow();
	});

	test("refuses a feed repeating a guid, which is what makes dedupe structural", async () => {
		await migrate();
		let insert = (id: string) =>
			sql.exec(
				`INSERT INTO feed_items (id, feed_id, guid, title, published_at, content_hash, created_at, updated_at)
				 VALUES (?, 'f1', 'g1', 't', 0, 'h', 0, 0)`,
				id,
			);

		insert("i1");
		expect(() => insert("i2")).toThrow();
	});

	test("allows the same guid under a different feed", async () => {
		await migrate();
		sql.exec(
			`INSERT INTO feed_items (id, feed_id, guid, title, published_at, content_hash, created_at, updated_at)
			 VALUES ('i1', 'f1', 'g1', 't', 0, 'h', 0, 0)`,
		);

		expect(() =>
			sql.exec(
				`INSERT INTO feed_items (id, feed_id, guid, title, published_at, content_hash, created_at, updated_at)
				 VALUES ('i2', 'f2', 'g1', 't', 0, 'h', 0, 0)`,
			),
		).not.toThrow();
	});
});

describe("query plans", () => {
	test("answers the global timeline from an index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, feed_id, title, published_at FROM feed_items
			 ORDER BY published_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feed_items_timeline_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});

	test("answers a feed's timeline from an index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, title, published_at FROM feed_items WHERE feed_id = 'f1'
			 ORDER BY published_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feed_items_feed_timeline_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});

	test("answers the unread timeline from the partial index", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, feed_id, title FROM feed_items WHERE read_at IS NULL
			 ORDER BY published_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feed_items_unread_timeline_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});

	/**
	 * Grouping wants an index led by `feed_id`, which the unread index is not: it leads
	 * with `published_at` so it can answer the timeline. SQLite therefore reaches for the
	 * guid index, which groups without sorting and filters unread from the row.
	 */
	test("counts unread per feed from an index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT feed_id, COUNT(*) FROM feed_items WHERE read_at IS NULL GROUP BY feed_id`,
		);

		expect(plan).toContain("feed_items_feed_guid_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR GROUP BY");
	});

	test("finds an item by feed and guid from the unique index", async () => {
		await migrate();

		let plan = queryPlan(`SELECT id FROM feed_items WHERE feed_id = 'f1' AND guid = 'g1'`);
		expect(plan).toContain("feed_items_feed_guid_idx");
	});
});
