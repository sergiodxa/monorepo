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
			"0006-shared-feed-objects",
			"0007-folders",
			"0008-tier",
			"0009-schedule",
			"0010-tags-and-pins",
			"0011-filter-rules",
			"0012-notifications",
			"0014-searches",
			"0015-presentation",
			"0016-keep-link-parameters",
			"0017-agent-tokens",
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
			"feeds_feed_id_idx",
			"feeds_subscription_idx",
			"feed_items_timeline_idx",
			"feed_items_feed_timeline_idx",
			"feed_items_unread_timeline_idx",
			"feed_items_read_timeline_idx",
			"feed_items_saved_idx",
			"feeds_title_idx",
			"folders",
			"folders_title_idx",
			"feed_items_folder_timeline_idx",
			"rules",
			"feed_items_flagged_idx",
			"searches",
			"searches_name_idx",
			"tokens",
			"tokens_created_at_idx",
			"rate_limit_hits",
			"rate_limit_hits_bucket_created_at_idx",
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

	/**
	 * A bounded search adds a second comparison on the same leading column the seek uses,
	 * so it shortens the range the timeline index is scanned over rather than filtering
	 * rows out of it — which is what keeps a searched page free of a temporary b-tree.
	 */
	test("answers a bounded search from a timeline index and sorts nothing", async () => {
		await migrate();

		let plans = {
			all: queryPlan(
				`SELECT id, title FROM feed_items
				 WHERE (title LIKE '%x%' ESCAPE '\\' OR summary LIKE '%x%' ESCAPE '\\'
				        OR author LIKE '%x%' ESCAPE '\\')
				   AND published_at >= 0
				 ORDER BY published_at DESC, id DESC LIMIT 51`,
			),
			unread: queryPlan(
				`SELECT id, title FROM feed_items
				 WHERE (title LIKE '%x%' ESCAPE '\\' OR summary LIKE '%x%' ESCAPE '\\'
				        OR author LIKE '%x%' ESCAPE '\\')
				   AND published_at >= 0 AND read_at IS NULL
				 ORDER BY published_at DESC, id DESC LIMIT 51`,
			),
			read: queryPlan(
				`SELECT id, title FROM feed_items
				 WHERE (title LIKE '%x%' ESCAPE '\\' OR summary LIKE '%x%' ESCAPE '\\'
				        OR author LIKE '%x%' ESCAPE '\\')
				   AND published_at >= 0 AND read_at IS NOT NULL
				 ORDER BY published_at DESC, id DESC LIMIT 51`,
			),
		};

		expect(plans.all).toContain("feed_items_timeline_idx");
		expect(plans.unread).toContain("feed_items_unread_timeline_idx");
		expect(plans.read).toContain("feed_items_read_timeline_idx");

		for (let plan of Object.values(plans)) expect(plan).not.toContain("TEMP B-TREE");
	});

	/** A folder-scoped search binds the folder itself, which the post carries a copy of. */
	test("answers a folder-scoped search without listing the folder's feeds", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, title FROM feed_items
			 WHERE (title LIKE '%x%' ESCAPE '\\' OR summary LIKE '%x%' ESCAPE '\\'
			        OR author LIKE '%x%' ESCAPE '\\')
			   AND published_at >= 0 AND folder_id = 'folder-1'
			 ORDER BY published_at DESC, id DESC LIMIT 51`,
		);

		expect(plan).not.toContain("TEMP B-TREE");
	});

	/** A label's own list pages by keyset, and a search inside it is that list's predicate. */
	test("answers a searched label from the join table's index and sorts nothing", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT i.id, i.title FROM item_tags t JOIN feed_items i ON i.id = t.item_id
			 WHERE t.tag_id = 'tag-1'
			   AND (i.title LIKE '%x%' ESCAPE '\\' OR i.summary LIKE '%x%' ESCAPE '\\'
			        OR i.author LIKE '%x%' ESCAPE '\\')
			   AND t.published_at >= 0
			 ORDER BY t.published_at DESC, t.item_id DESC LIMIT 51`,
		);

		expect(plan).not.toContain("TEMP B-TREE");
	});
});

describe("schema constraints", () => {
	test("refuses a velocity that is not one of the ones on offer", async () => {
		await migrate();
		let insert = (id: string, velocity: string) =>
			sql.exec(
				`INSERT INTO feeds (id, feed_id, feed_url, title, velocity, created_at, updated_at)
				 VALUES (?, ?, ?, 't', ?, 0, 0)`,
				id,
				`canonical-${id}`,
				`https://example.com/${id}`,
				velocity,
			);

		expect(() => insert("f1", "hourly")).toThrow();
		expect(() => insert("f2", "breaking")).not.toThrow();
	});

	test("refuses a rule field and a rule action the named lists do not carry", async () => {
		await migrate();
		let insert = (id: string, field: string, action: string) =>
			sql.exec(
				`INSERT INTO rules (id, feed_id, field, value, action, matches, created_at, updated_at)
				 VALUES (?, NULL, ?, 'sponsored', ?, 0, 0, 0)`,
				id,
				field,
				action,
			);

		expect(() => insert("r1", "body", "drop")).toThrow();
		expect(() => insert("r2", "title", "save")).toThrow();
		expect(() => insert("r3", "title", "drop")).not.toThrow();
	});

	/** The three states the queue offers are the three a kept query may be kept under. */
	test("refuses a saved search under a read state the queue does not offer", async () => {
		await migrate();
		let insert = (id: string, readState: string) =>
			sql.exec(
				`INSERT INTO searches (id, name, query, read_state, feed_id, created_at, updated_at)
				 VALUES (?, ?, 'remix', ?, NULL, 0, 0)`,
				id,
				id,
				readState,
			);

		expect(() => insert("s1", "flagged")).toThrow();
		expect(() => insert("s2", "unread")).not.toThrow();
	});

	/** Two scopes are what a token may carry, and the column repeats them as a `CHECK`. */
	test("refuses a token under a scope no path of this app could have written", async () => {
		await migrate();
		let insert = (id: string, scope: string) =>
			sql.exec(
				`INSERT INTO tokens (id, name, scope, hash, created_at, expires_at)
				 VALUES (?, 'Laptop', ?, 'digest', 0, 1)`,
				id,
				scope,
			);

		expect(() => insert("t1", "admin")).toThrow();
		expect(() => insert("t2", "read")).not.toThrow();
		expect(() => insert("t3", "write")).not.toThrow();
	});

	/** A token answers until it is revoked or expires, so neither stamp starts written. */
	test("leaves a new token unused, unrevoked and answering", async () => {
		await migrate();
		sql.exec(
			`INSERT INTO tokens (id, name, scope, hash, created_at, expires_at)
			 VALUES ('t1', 'Laptop', 'read', 'digest', 0, 1)`,
		);

		let [row] = [
			...sql.exec<{ last_used_at: number | null; revoked_at: number | null }>(
				`SELECT last_used_at, revoked_at FROM tokens WHERE id = 't1'`,
			),
		];

		expect(row).toEqual({ last_used_at: null, revoked_at: null });
	});

	test("refuses a second row in settings", async () => {
		await migrate();
		sql.exec(`INSERT INTO settings (id, subject, created_at, updated_at) VALUES (1, 's', 0, 0)`);

		expect(() =>
			sql.exec(`INSERT INTO settings (id, subject, created_at, updated_at) VALUES (2, 's', 0, 0)`),
		).toThrow();
	});

	/**
	 * A reader's copy of an item is keyed by the id the feed minted for it, so the same
	 * item arriving twice is an upsert on a primary key. The guid rides along as what the
	 * publisher called it and constrains nothing here: a feed purged after its grace week
	 * re-mints its ids, and a reader still holding a saved post from it would otherwise
	 * meet an index refusing the very write that brings them back up to date.
	 */
	test("keys a post by the id its feed minted, and lets a guid repeat", async () => {
		await migrate();
		let insert = (id: string, feedId: string) =>
			sql.exec(
				`INSERT INTO feed_items (id, feed_id, guid, title, published_at, created_at, updated_at)
				 VALUES (?, ?, 'g1', 't', 0, 0, 0)`,
				id,
				feedId,
			);

		insert("i1", "f1");
		expect(() => insert("i1", "f1")).toThrow();
		expect(() => insert("i2", "f1")).not.toThrow();
		expect(() => insert("i3", "f2")).not.toThrow();
	});

	/**
	 * Two rows called Tech are two rows a reader cannot tell apart in a rail, and the
	 * uniqueness is also what makes filing by name an upsert rather than a duplicate.
	 */
	test("refuses a second folder by a name the reader already uses", async () => {
		await migrate();
		let insert = (id: string, title: string) =>
			sql.exec(
				`INSERT INTO folders (id, title, created_at, updated_at) VALUES (?, ?, 0, 0)`,
				id,
				title,
			);

		insert("d1", "Tech");
		expect(() => insert("d2", "Tech")).toThrow();
		/** Uniqueness is over bytes, as everywhere else here, so these are two folders. */
		expect(() => insert("d3", "tech")).not.toThrow();
	});

	test("leaves every existing row in no folder, which is what the column means", async () => {
		await migrate();
		sql.exec(
			`INSERT INTO feeds (id, feed_id, feed_url, title, created_at, updated_at)
			 VALUES ('f1', 'canonical-1', 'https://example.com/feed', 't', 0, 0)`,
		);

		let [row] = [...sql.exec<{ folder_id: string | null }>(`SELECT folder_id FROM feeds`)];

		expect(row?.folder_id).toBeNull();
	});

	test("refuses a second subscription to one canonical feed", async () => {
		await migrate();
		let insert = (id: string, feedId: string) =>
			sql.exec(
				`INSERT INTO feeds (id, feed_id, feed_url, title, created_at, updated_at)
				 VALUES (?, ?, ?, 't', 0, 0)`,
				id,
				feedId,
				`https://example.com/${id}`,
			);

		insert("f1", "canonical-1");
		expect(() => insert("f2", "canonical-1")).toThrow();
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

	/**
	 * The whole point of the folder living on the post: a page of a group is the page of
	 * one feed with the leading column changed, so neither the reader's history nor how
	 * many feeds are in the folder enters what it costs.
	 */
	test("answers a folder's timeline from its partial index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, feed_id, title, published_at FROM feed_items WHERE folder_id = 'd1'
			 ORDER BY published_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feed_items_folder_timeline_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});

	/**
	 * The page past the first is the one a reader scrolling spends their time in, and it
	 * is a different statement: the seek on the ordering columns has to stay on the same
	 * index rather than falling back to a sort of every post in the folder.
	 */
	test("keeps a folder's seeked page on that index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, feed_id, title, published_at FROM feed_items
			 WHERE folder_id = 'd1'
			   AND (published_at < 100 OR (published_at = 100 AND id < 'i9'))
			 ORDER BY published_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feed_items_folder_timeline_idx");
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
	 * one feed's-timeline index, which is led by the feed and so groups without sorting.
	 */
	test("counts unread per feed from an index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT feed_id, COUNT(*) FROM feed_items WHERE read_at IS NULL GROUP BY feed_id`,
		);

		expect(plan).toContain("feed_items_feed_timeline_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR GROUP BY");
	});

	/**
	 * Every agent request reads one bucket since one instant, which is the read the index
	 * carries both columns in order for.
	 */
	test("answers a token's daily budget from an index, without scanning", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, cost FROM rate_limit_hits WHERE bucket = 'agent:tok_1' AND created_at >= 0
			 ORDER BY created_at ASC`,
		);

		expect(plan).toContain("rate_limit_hits_bucket_created_at_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});

	/**
	 * The saved list is the fourth thing this table is read as, and it pages by the same
	 * keyset as the other three, so it earns the same treatment: an index holding only the
	 * rows a reader asked to keep, in the order the page reads them.
	 */
	test("answers the saved list from an index, without sorting", async () => {
		await migrate();

		let plan = queryPlan(
			`SELECT id, feed_id, title FROM feed_items WHERE saved_at IS NOT NULL
			 ORDER BY published_at DESC, id DESC LIMIT 50`,
		);

		expect(plan).toContain("feed_items_saved_idx");
		expect(plan).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});
});

/**
 * The closed sets a reader's answers are held to. Each is named once in TypeScript and once
 * in a `CHECK` repeating it, so the assertion worth making is that the database refuses a
 * value no path of this app could have written.
 */
describe("presentation", () => {
	beforeEach(async () => {
		await migrate();
		sql.exec(
			`INSERT INTO settings (id, subject, created_at, updated_at) VALUES (1, 'reader', 0, 0)`,
		);
	});

	test("paints a reader's pages the way their system does until they say otherwise", () => {
		let [row] = [
			...sql.exec<{ theme: string; reading_face: string }>(
				`SELECT theme, reading_face FROM settings WHERE id = 1`,
			),
		];

		expect(row).toEqual({ theme: "system", reading_face: "sans" });
	});

	test("refuses a scheme or a face outside its set", () => {
		expect(() => sql.exec(`UPDATE settings SET theme = 'sepia' WHERE id = 1`)).toThrow();
		expect(() => sql.exec(`UPDATE settings SET reading_face = 'mono' WHERE id = 1`)).toThrow();
	});

	test("draws a subscription's posts as text until the reader asks for the other mode", () => {
		sql.exec(
			`INSERT INTO feeds (id, feed_id, feed_url, title, created_at, updated_at)
			 VALUES ('sub', 'feed', 'https://example.com/feed', 'Example', 0, 0)`,
		);

		let [row] = [
			...sql.exec<{ presentation: string }>(`SELECT presentation FROM feeds WHERE id = 'sub'`),
		];

		expect(row?.presentation).toBe("text");

		expect(() => sql.exec(`UPDATE feeds SET presentation = 'audio' WHERE id = 'sub'`)).toThrow();
	});
});
