/**
 * Tests for the D1 `DatabaseAdapter`.
 *
 * A real Cloudflare D1 binding is not available in a plain `bun:test` process, so
 * these tests drive the real adapter through a small `D1Database`-shaped shim over
 * `bun:sqlite`. The shim implements the exact surface the adapter touches
 * (`prepare(text).bind(...).all()/run()` returning `{ results, meta }`, plus
 * `exec`), so `createD1DatabaseAdapter` runs unmodified.
 *
 * D1 has no interactive transactions, so the adapter cannot make a `transaction()`
 * scope atomic (see the note on `createD1DatabaseAdapter`). These tests pin that
 * documented behavior: a successful transaction persists every write, and a failing
 * transaction leaves the writes that already ran committed rather than rolling them
 * back. The shim deliberately runs each statement immediately with autocommit — it
 * does NOT wrap the scope in a SQLite transaction — so it reproduces D1 semantics
 * instead of hiding the limitation behind `bun:sqlite`'s own transaction support.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as BunSqlite, type SQLQueryBindings } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";

import { column as c, createDatabase, table } from "remix/data-table";

import type { D1StatementObservation, D1StatementObserver } from "./index";

import { createD1DatabaseAdapter } from "./index";

/**
 * Minimal `D1Database`-shaped wrapper over a `bun:sqlite` database.
 *
 * Each prepared statement executes immediately and autocommits, mirroring D1, which
 * exposes no `BEGIN`/`COMMIT`/`ROLLBACK`. Results are shaped like D1's `D1Result`
 * (`{ results, meta: { changes, last_row_id } }`).
 * @param db Open `bun:sqlite` database.
 * @returns An object matching the `D1Database` surface consumed by the adapter.
 */
function createD1Shim(db: BunSqlite): D1Database {
	function prepare(text: string) {
		let bound: SQLQueryBindings[] = [];

		let statement = {
			bind(...values: unknown[]) {
				bound = values as SQLQueryBindings[];
				return statement;
			},
			all() {
				let before = readTotalChanges(db);
				let results = db.query(text).all(...bound) as Record<string, unknown>[];
				let meta = readMeta(db, results.length, readTotalChanges(db) - before);
				return Promise.resolve({ results, meta });
			},
			run() {
				let before = readTotalChanges(db);
				db.query(text).run(...bound);
				let meta = readMeta(db, 0, readTotalChanges(db) - before);
				return Promise.resolve({ results: [], meta });
			},
		};

		return statement;
	}

	return {
		prepare,
		exec(sql: string) {
			db.run(sql);
			return Promise.resolve({ count: 0, duration: 0 });
		},
	} as unknown as D1Database;
}

/**
 * Fixed `meta.duration` the shim reports, so a test can tell a duration that was
 * passed through from D1's own metadata apart from one measured locally.
 */
const SHIM_DURATION_MS = 1.5;

/**
 * Reads the change count and last insert id after a statement, shaped like D1 meta,
 * plus the `rows_read`/`rows_written`/`duration` fields D1 reports and the adapter's
 * `onStatement` observer surfaces. `rows_read` is the number of rows the statement
 * returned, which is as close as a `bun:sqlite` shim can get to D1's "rows read from
 * tables and indexes" — the shim can pin the plumbing, not the planner.
 * @param db Open `bun:sqlite` database.
 * @param rowsRead Rows the statement returned.
 * @param rowsWritten Rows the statement wrote, measured as a `total_changes()` delta
 * because SQLite's `changes()` reports the _previous_ write's count for a statement
 * that only read rows.
 * @returns D1-style statement metadata.
 */
function readMeta(
	db: BunSqlite,
	rowsRead: number,
	rowsWritten: number,
): {
	changes: number;
	last_row_id: number;
	rows_read: number;
	rows_written: number;
	duration: number;
} {
	let changes = db.query("SELECT changes() as changes").get() as { changes: number };
	let lastId = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
	return {
		changes: changes.changes,
		last_row_id: lastId.id,
		rows_read: rowsRead,
		rows_written: rowsWritten,
		duration: SHIM_DURATION_MS,
	};
}

/**
 * Reads SQLite's cumulative change counter for the connection.
 * @param db Open `bun:sqlite` database.
 * @returns Total rows changed since the connection opened.
 */
function readTotalChanges(db: BunSqlite): number {
	let row = db.query("SELECT total_changes() as total").get() as { total: number };
	return row.total;
}

/**
 * A `D1Database` shim whose statements report no metadata at all, standing in for a
 * D1 build (or a future one) that omits the row counters.
 * @param db Open `bun:sqlite` database.
 * @returns An object matching the `D1Database` surface, with empty statement meta.
 */
function createMetalessD1Shim(db: BunSqlite): D1Database {
	function prepare(text: string) {
		let bound: SQLQueryBindings[] = [];

		let statement = {
			bind(...values: unknown[]) {
				bound = values as SQLQueryBindings[];
				return statement;
			},
			all() {
				let results = db.query(text).all(...bound) as Record<string, unknown>[];
				return Promise.resolve({ results, meta: {} });
			},
			run() {
				db.query(text).run(...bound);
				return Promise.resolve({ results: [], meta: {} });
			},
		};

		return statement;
	}

	return {
		prepare,
		exec(sql: string) {
			db.run(sql);
			return Promise.resolve({ count: 0, duration: 0 });
		},
	} as unknown as D1Database;
}

let users = table({
	name: "users",
	columns: {
		id: c.integer().primaryKey(),
		email: c.varchar(255),
	},
});

let settings = table({
	name: "settings",
	columns: {
		id: c.integer().primaryKey(),
		config: c.json(),
	},
});

/**
 * Builds a fresh in-memory database, adapter, and `remix/data-table` handle.
 * @returns The `remix/data-table` `db` and the raw `bun:sqlite` instance.
 */
function setup() {
	let sqlite = new BunSqlite(":memory:");
	sqlite.run("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");

	let adapter = createD1DatabaseAdapter(createD1Shim(sqlite));
	let db = createDatabase(adapter);

	return { db, sqlite };
}

describe("createD1DatabaseAdapter", () => {
	let db: ReturnType<typeof setup>["db"];

	beforeEach(() => {
		db = setup().db;
	});

	test("does not advertise savepoint support", () => {
		let adapter = createD1DatabaseAdapter(createD1Shim(new BunSqlite(":memory:")));
		expect(adapter.capabilities.savepoints).toBe(false);
	});

	test("commits every write when the transaction succeeds", async () => {
		await db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			await tx.create(users, { id: 2, email: "second@example.com" });
		});

		expect(await db.count(users)).toBe(2);
	});

	test("basic reads and writes work outside a transaction", async () => {
		let created = await db.create(users, { id: 5, email: "five@example.com" }, { returnRow: true });
		expect(created.email).toBe("five@example.com");

		let found = await db.findOne(users, { where: { id: 5 } });
		expect(found?.email).toBe("five@example.com");

		let updated = await db.update(users, 5, { email: "updated@example.com" });
		expect(updated.email).toBe("updated@example.com");

		expect(await db.count(users)).toBe(1);
	});

	test("RETURNING inside a transaction works because statements run immediately", async () => {
		// The remix/data-table `create`/`update` helpers require synchronous
		// RETURNING results, which the adapter can only satisfy by executing each
		// statement immediately. This is exactly why the scope cannot be atomic.
		let updated = await db.transaction(async (tx) => {
			await tx.create(users, { id: 9, email: "nine@example.com" });
			return tx.update(users, 9, { email: "changed@example.com" });
		});

		expect(updated.email).toBe("changed@example.com");
	});

	test("db.exec() with a raw SELECT returns rows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let result = await db.exec("SELECT email FROM users WHERE id = ?", [2]);

		expect(result.rows).toEqual([{ email: "two@example.com" }]);
	});

	test("db.exec() with a raw WITH/CTE query returns rows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });

		let result = await db.exec("WITH ranked AS (SELECT email FROM users) SELECT * FROM ranked");

		expect(result.rows).toEqual([{ email: "one@example.com" }]);
	});

	test("db.exec() with a raw DELETE still reports affectedRows, not rows", async () => {
		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });

		let result = await db.exec("DELETE FROM users WHERE id = ?", [1]);

		expect(result.affectedRows).toBe(1);
		expect(await db.count(users)).toBe(1);
	});

	test("c.json() columns round-trip through create/findOne without throwing", async () => {
		await db.exec("CREATE TABLE settings (id INTEGER PRIMARY KEY, config TEXT)");

		let config = { strategy: "email", config: { to: "user@example.com" } };
		let created = await db.create(settings, { id: 1, config }, { returnRow: true });

		expect(created.config).toEqual(config);

		let found = await db.findOne(settings, { where: { id: 1 } });
		expect(found?.config).toEqual(config);
	});

	test("DOCUMENTS D1 limitation: a failing transaction does NOT roll back earlier writes", async () => {
		let boom = new Error("second statement failed");

		let promise = db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			throw boom;
		});

		await expect(promise).rejects.toBe(boom);

		// D1 has no ROLLBACK: the first write already auto-committed and remains.
		// This asserts the honest, documented behavior — NOT desired atomicity.
		// The Durable Object adapter (@pkg/data-table-sqlstorage) rolls this back;
		// D1 cannot. If this ever starts returning 0, the adapter gained real
		// atomicity and the docs/tests should be revisited.
		expect(await db.count(users)).toBe(1);
	});
});

describe("createD1DatabaseAdapter onStatement", () => {
	/**
	 * Builds a database whose adapter reports every statement into `observations`.
	 * @param onStatement Observer to install, defaulting to one that records.
	 * @returns The `db` handle and the array the observer appends to.
	 */
	function setupObserved(onStatement?: D1StatementObserver) {
		let observations: D1StatementObservation[] = [];
		let sqlite = new BunSqlite(":memory:");
		sqlite.run("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");

		let db = createDatabase(
			createD1DatabaseAdapter(createD1Shim(sqlite), {
				onStatement:
					onStatement ??
					((observation) => {
						observations.push(observation);
					}),
			}),
		);

		return { db, observations };
	}

	test("reports one observation per executed statement", async () => {
		let { db, observations } = setupObserved();

		await db.create(users, { id: 1, email: "one@example.com" });
		await db.findOne(users, { where: { id: 1 } });

		expect(observations).toHaveLength(2);
		expect(observations.map((observation) => observation.kind)).toEqual(["insert", "select"]);
		expect(observations.map((observation) => observation.table)).toEqual(["users", "users"]);
	});

	test("surfaces the rows read, rows written, and duration D1 reported", async () => {
		let { db, observations } = setupObserved();

		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });
		observations.length = 0;

		await db.findMany(users);

		expect(observations).toHaveLength(1);
		expect(observations[0]?.rowsRead).toBe(2);
		expect(observations[0]?.rowsWritten).toBe(0);
		// Passed through from `meta.duration` rather than timed by the adapter.
		expect(observations[0]?.durationMs).toBe(1.5);
	});

	test("counts a write's rows written from meta rather than from returned rows", async () => {
		let { db, observations } = setupObserved();

		await db.create(users, { id: 1, email: "one@example.com" });

		expect(observations[0]?.rowsWritten).toBe(1);
	});

	test("reports a raw statement with no table", async () => {
		let { db, observations } = setupObserved();

		await db.exec("SELECT 1 as one");

		expect(observations).toHaveLength(1);
		expect(observations[0]?.kind).toBe("raw");
		expect(observations[0]?.table).toBeUndefined();
	});

	test("reports zeros when D1 omits the counters instead of guessing", async () => {
		let observations: D1StatementObservation[] = [];
		let sqlite = new BunSqlite(":memory:");
		sqlite.run("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
		let db = createDatabase(
			createD1DatabaseAdapter(createMetalessD1Shim(sqlite), {
				onStatement: (observation) => observations.push(observation),
			}),
		);

		await db.create(users, { id: 1, email: "one@example.com" });

		expect(observations[0]?.rowsRead).toBe(0);
		expect(observations[0]?.rowsWritten).toBe(0);
		expect(observations[0]?.durationMs).toBe(0);
	});

	test("an observer that throws does not fail the statement it was measuring", async () => {
		let { db } = setupObserved(() => {
			throw new Error("logging blew up");
		});

		let created = await db.create(
			users,
			{ id: 7, email: "seven@example.com" },
			{ returnRow: true },
		);

		expect(created.email).toBe("seven@example.com");
		expect(await db.count(users)).toBe(1);
	});

	test("an adapter without an observer behaves exactly as before", async () => {
		let sqlite = new BunSqlite(":memory:");
		sqlite.run("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
		let db = createDatabase(createD1DatabaseAdapter(createD1Shim(sqlite)));

		await db.create(users, { id: 1, email: "one@example.com" });

		expect(await db.count(users)).toBe(1);
	});
});
