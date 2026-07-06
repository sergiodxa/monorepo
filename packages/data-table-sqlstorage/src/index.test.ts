/**
 * Tests for the SqlStorage `DatabaseAdapter`, focused on transaction atomicity.
 *
 * Durable Object `SqlStorage` runs synchronously and is not available in a plain
 * `bun:test` process, so these tests drive the real adapter through a small
 * `SqlStorage`-shaped shim over `bun:sqlite`. The shim implements the exact surface
 * the adapter touches (`exec(query, ...bindings)` returning a cursor with
 * `toArray()` and `rowsWritten`), so `createSQLStorageDatabaseAdapter` runs
 * unmodified against an in-memory SQLite database that supports real
 * `BEGIN`/`COMMIT`/`ROLLBACK`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as BunSqlite, type SQLQueryBindings } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";

import { column as c, createDatabase, table } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "./index";

/**
 * Minimal `SqlStorage`-shaped wrapper over a `bun:sqlite` database.
 *
 * Only the members the adapter uses are implemented; every `exec` runs the
 * statement immediately and reports the rows written via SQLite's `changes()`.
 * @param db Open `bun:sqlite` database.
 * @returns An object matching the `SqlStorage` surface consumed by the adapter.
 */
function createSqlStorageShim(db: BunSqlite): SqlStorage {
	return {
		exec(query: string, ...bindings: unknown[]) {
			let rows = db.query(query).all(...(bindings as SQLQueryBindings[])) as Record<
				string,
				unknown
			>[];
			let changes = db.query("SELECT changes() as changes").get() as { changes: number };

			return {
				toArray: () => rows,
				rowsWritten: changes.changes,
			};
		},
	} as unknown as SqlStorage;
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

	let adapter = createSQLStorageDatabaseAdapter(createSqlStorageShim(sqlite));
	let db = createDatabase(adapter);

	return { db, sqlite };
}

describe("createSQLStorageDatabaseAdapter", () => {
	let db: ReturnType<typeof setup>["db"];

	beforeEach(() => {
		db = setup().db;
	});

	test("advertises savepoint support", () => {
		let adapter = createSQLStorageDatabaseAdapter(createSqlStorageShim(new BunSqlite(":memory:")));
		expect(adapter.capabilities.savepoints).toBe(true);
	});

	test("commits every write when the transaction succeeds", async () => {
		await db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			await tx.create(users, { id: 2, email: "second@example.com" });
		});

		expect(await db.count(users)).toBe(2);
	});

	test("rolls back the first write when a later statement throws", async () => {
		let boom = new Error("second statement failed");

		let promise = db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
			// The first write is already issued; throwing here must undo it.
			throw boom;
		});

		await expect(promise).rejects.toBe(boom);

		// Atomicity: none of the transaction's writes may remain committed.
		expect(await db.count(users)).toBe(0);
	});

	test("rolls back when a later statement violates a constraint", async () => {
		await db.create(users, { id: 1, email: "existing@example.com" });

		let promise = db.transaction(async (tx) => {
			await tx.create(users, { id: 2, email: "second@example.com" });
			// Duplicate primary key: the SQLite driver throws, rolling back id 2.
			await tx.create(users, { id: 1, email: "conflict@example.com" });
		});

		await expect(promise).rejects.toThrow();

		// Only the pre-existing row survives; the transaction's write is gone.
		expect(await db.count(users)).toBe(1);
		expect(await db.findOne(users, { where: { id: 2 } })).toBeNull();
	});

	test("keeps writes from separate committed transactions", async () => {
		await db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
		});

		let promise = db.transaction(async (tx) => {
			await tx.create(users, { id: 2, email: "second@example.com" });
			throw new Error("fail");
		});
		await expect(promise).rejects.toThrow();

		await db.transaction(async (tx) => {
			await tx.create(users, { id: 3, email: "third@example.com" });
		});

		// The committed transactions persist; the rolled-back one leaves no trace.
		let rows = await db.findMany(users, { orderBy: ["id"] });
		expect(rows.map((row) => row.id)).toEqual([1, 3]);
	});

	test("nested transactions roll back independently via savepoints", async () => {
		await db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "outer@example.com" });

			let inner = tx.transaction(async (nested) => {
				await nested.create(users, { id: 2, email: "inner@example.com" });
				throw new Error("inner fail");
			});
			await expect(inner).rejects.toThrow();
		});

		// The inner savepoint rolled back, the outer transaction committed.
		let rows = await db.findMany(users, { orderBy: ["id"] });
		expect(rows.map((row) => row.id)).toEqual([1]);
	});

	test("reads and RETURNING writes inside a transaction return live results", async () => {
		let created = await db.transaction(async (tx) => {
			let row = await tx.create(users, { id: 7, email: "seven@example.com" }, { returnRow: true });
			// A read issued within the same transaction observes the write.
			let count = await tx.count(users);
			expect(count).toBe(1);
			return row;
		});

		expect(created.id).toBe(7);
		expect(created.email).toBe("seven@example.com");
	});
});
