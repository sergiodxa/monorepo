/**
 * Tests for the SqlStorage `DatabaseDriver`, focused on transaction atomicity.
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

import { column as c, Database, table } from "remix/data-table";

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

let settings = table({
	name: "settings",
	columns: {
		id: c.integer().primaryKey(),
		config: c.json(),
	},
});

let flags = table({
	name: "flags",
	columns: {
		id: c.integer().primaryKey(),
		enabled: c.boolean(),
		archived: c.boolean().nullable(),
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
	let db = new Database(adapter);

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

	test("c.boolean() columns read back as real booleans, not SQLite's 1 and 0", async () => {
		await db.exec(
			"CREATE TABLE flags (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL, archived INTEGER)",
		);

		await db.create(flags, { id: 1, enabled: false, archived: null });
		await db.create(flags, { id: 2, enabled: true, archived: true });

		let off = await db.findOne(flags, { where: { id: 1 } });
		let on = await db.findOne(flags, { where: { id: 2 } });

		// `toBe` rather than a truthiness check on purpose: `0` is the exact value that
		// used to leak out here, and it renders `checked="0"` — an HTML boolean attribute
		// that is ON — so a stored `false` came back ticked. Only identity catches that.
		expect(off?.enabled).toBe(false);
		expect(on?.enabled).toBe(true);

		// A nullable boolean's `null` is a third state and must survive the decode, or
		// every `?? true` default written over one silently stops firing.
		expect(off?.archived).toBe(null);
		expect(on?.archived).toBe(true);
	});

	test("c.boolean() columns decode on the returning path too, not only on select", async () => {
		await db.exec(
			"CREATE TABLE flags (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL, archived INTEGER)",
		);

		let created = await db.create(
			flags,
			{ id: 1, enabled: false, archived: null },
			{ returnRow: true },
		);
		expect(created.enabled).toBe(false);

		let updated = await db.update(flags, 1, { enabled: true });
		expect(updated.enabled).toBe(true);
	});
});
