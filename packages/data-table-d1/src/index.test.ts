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
				let results = db.query(text).all(...bound) as Record<string, unknown>[];
				let meta = readMeta(db);
				return Promise.resolve({ results, meta });
			},
			run() {
				db.query(text).run(...bound);
				let meta = readMeta(db);
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
 * Reads the change count and last insert id after a statement, shaped like D1 meta.
 * @param db Open `bun:sqlite` database.
 * @returns D1-style `{ changes, last_row_id }` metadata.
 */
function readMeta(db: BunSqlite): { changes: number; last_row_id: number } {
	let changes = db.query("SELECT changes() as changes").get() as { changes: number };
	let lastId = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
	return { changes: changes.changes, last_row_id: lastId.id };
}

let users = table({
	name: "users",
	columns: {
		id: c.integer().primaryKey(),
		email: c.varchar(255),
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
