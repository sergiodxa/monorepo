/**
 * Verifies the schema against a real SQLite database: that migrating is repeatable,
 * that every index exists, and — the assertion that matters most — that every paging
 * query is answered from an index instead of sorting.
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
	test("applies every migration, in the order they are journaled", async () => {
		expect((await migrate()).applied).toEqual([
			"0001-init",
			"0002-drop-item-content",
			"0003-feed-list-index",
			"0004-read-timeline-index",
			"0005-feed-title-index",
		]);
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
			"feeds_subscription_idx",
			"feed_items_feed_guid_idx",
			"feed_items_timeline_idx",
			"feed_items_feed_timeline_idx",
			"feed_items_unread_timeline_idx",
			"feed_items_read_timeline_idx",
			"feeds_title_idx",
		]) {
			expect(names, `${name} exists`).toContain(name);
		}
	});

	test("leaves a post no body column, which nothing read back", async () => {
		await migrate();

		let columns = [...sql.exec<{ name: string }>(`PRAGMA table_info(feed_items)`)].map(
			(row) => row.name,
		);

		expect(columns).not.toContain("content");

		// The summary is the one piece of a post's text a reader is shown, so it stays where
		// the body went, and the timeline still has something to render under a title.
		expect(columns).toContain("summary");
	});

	test("keeps every index the body column was dropped around", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, feed_id, title FROM feed_items WHERE read_at IS NULL
			 ORDER BY published_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feed_items_unread_timeline_idx");
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

	test("answers the export's subscription list from an index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, title, created_at FROM feeds
			 ORDER BY created_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feeds_subscription_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});

	/**
	 * The rail draws every feed a reader follows, in the order their names read, so this
	 * one sorts the whole table rather than a page of it — which is exactly the read a
	 * temporary b-tree would be built for.
	 */
	test("answers the rail's subscription list from an index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(`SELECT id, title FROM feeds ORDER BY title ASC, id ASC`);

		expect(plan).toContain("feeds_title_idx");
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
	 * The read posts are the ones that pile up, since a post is read once and stays read,
	 * so this is the reading-queue filter with the most rows behind it. Its own partial
	 * index is what keeps it reading like the other two.
	 */
	test("answers the read timeline from the partial index", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, feed_id, title FROM feed_items WHERE read_at IS NOT NULL
			 ORDER BY published_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feed_items_read_timeline_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});

	/**
	 * A page past the first seeks on the ordering columns, which is a different statement
	 * from the first page and the one a reader scrolling spends their time in. Each of the
	 * three reading-queue filters keeps its index under that seek.
	 */
	test("keeps every reading-queue filter on its index while paging", async () => {
		await migrate();

		let seek = `(published_at < 100 OR (published_at = 100 AND id < 'i9'))`;

		let plans = {
			all: queryPlan(
				`SELECT id, feed_id, title FROM feed_items WHERE ${seek}
				 ORDER BY published_at DESC, id DESC LIMIT 50`,
			),
			unread: queryPlan(
				`SELECT id, feed_id, title FROM feed_items WHERE read_at IS NULL AND ${seek}
				 ORDER BY published_at DESC, id DESC LIMIT 50`,
			),
			read: queryPlan(
				`SELECT id, feed_id, title FROM feed_items WHERE read_at IS NOT NULL AND ${seek}
				 ORDER BY published_at DESC, id DESC LIMIT 50`,
			),
		};

		expect(plans.all).toContain("feed_items_timeline_idx");
		expect(plans.unread).toContain("feed_items_unread_timeline_idx");
		expect(plans.read).toContain("feed_items_read_timeline_idx");

		for (let [filter, plan] of Object.entries(plans)) {
			expect(plan, `${filter} sorts nothing`).not.toContain("USE TEMP B-TREE FOR ORDER BY");
		}
	});

	/**
	 * A query and a read state narrow the same page once the two surfaces are one, so every
	 * pairing of them is a statement a reader can ask for. A substring match begins
	 * anywhere in the text, so no index answers the match itself; what these assert is that
	 * each pairing still reads its rows in published order from the index the read state
	 * owns, testing the words off each row as it goes, rather than collecting the matches
	 * and sorting them afterwards.
	 */
	test("keeps a searched queue on its read state's index, under every filter", async () => {
		await migrate();

		let match = `(title LIKE '%remix%' ESCAPE '\\' OR summary LIKE '%remix%' ESCAPE '\\')`;
		let seek = `(published_at < 100 OR (published_at = 100 AND id < 'i9'))`;

		/** Both pages a reader asks for: the one the box lands on, and the ones they scroll into. */
		let pagesOf = (filter: string) => ({
			first: queryPlan(
				`SELECT id, feed_id, title, summary FROM feed_items WHERE ${match}${filter}
				 ORDER BY published_at DESC, id DESC LIMIT 50`,
			),
			next: queryPlan(
				`SELECT id, feed_id, title, summary FROM feed_items WHERE ${match}${filter} AND ${seek}
				 ORDER BY published_at DESC, id DESC LIMIT 50`,
			),
		});

		let plans = {
			all: [pagesOf(""), "feed_items_timeline_idx"],
			unread: [pagesOf(" AND read_at IS NULL"), "feed_items_unread_timeline_idx"],
			read: [pagesOf(" AND read_at IS NOT NULL"), "feed_items_read_timeline_idx"],
		} as const;

		for (let [filter, [pages, index]] of Object.entries(plans)) {
			for (let [page, plan] of Object.entries(pages)) {
				expect(plan, `${filter}, ${page} page, reads ${index}`).toContain(index);
				expect(plan, `${filter}, ${page} page, sorts nothing`).not.toContain(
					"USE TEMP B-TREE FOR ORDER BY",
				);
			}
		}
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
