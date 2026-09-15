/**
 * Tests for the SqlStorage `DatabaseDriver`, focused on the guarantee it actually offers:
 * statements that take effect one at a time, and no transaction scope to hide behind.
 *
 * Durable Object `SqlStorage` is not available in the test runner, so these drive the real
 * adapter through a small `SqlStorage`-shaped shim over an in-memory `node:sqlite`
 * database. The shim refuses transaction-control statements exactly as the platform does,
 * so SQL the driver must never emit fails here rather than in a deployed object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

import { column as c, Database, table } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { createSQLStorageDatabaseAdapter } from "./index.js";

import type { SQLInputValue } from "node:sqlite";

/** Leading keywords of the statements a Durable Object's SQL storage rejects. */
let transactionKeywords = new Set(["BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE"]);

/** The message the Durable Objects runtime raises for a transaction-control statement. */
let transactionStatementMessage =
	"To execute a transaction, please use the state.storage.transaction() or " +
	"state.storage.transactionSync() APIs instead of the SQL BEGIN TRANSACTION or SAVEPOINT " +
	"statements.";

/**
 * Minimal `SqlStorage`-shaped wrapper over a `node:sqlite` database.
 *
 * Only the members the adapter uses are implemented; every `exec` runs the statement
 * immediately, reports the rows written via SQLite's `changes()`, and refuses a
 * transaction-control statement the way the platform refuses it.
 * @param db Open `node:sqlite` database.
 * @returns An object matching the `SqlStorage` surface consumed by the adapter.
 */
function createSqlStorageShim(db: DatabaseSync): SqlStorage {
	return {
		exec(query: string, ...bindings: unknown[]) {
			let keyword = /^[A-Za-z_]+/.exec(query.trim());

			if (keyword && transactionKeywords.has(keyword[0].toUpperCase())) {
				throw new Error(transactionStatementMessage);
			}

			let rows = db.prepare(query).all(...(bindings as SQLInputValue[])) as Record<
				string,
				unknown
			>[];
			let changes = db.prepare("SELECT changes() as changes").get() as { changes: number };

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
 * @returns The adapter, the `remix/data-table` `db`, and the raw `node:sqlite` instance.
 */
function setup() {
	let sqlite = new DatabaseSync(":memory:");
	sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");

	let adapter = createSQLStorageDatabaseAdapter(createSqlStorageShim(sqlite));
	let db = new Database(adapter);

	return { adapter, db, sqlite };
}

/**
 * Runs a promise to its rejection.
 * @param promise Work expected to fail.
 * @returns The error it failed with.
 */
async function rejection(promise: Promise<unknown>): Promise<Error> {
	try {
		await promise;
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}

	throw new Error("Expected the promise to reject");
}

describe("createSQLStorageDatabaseAdapter", () => {
	let adapter: ReturnType<typeof setup>["adapter"];
	let db: ReturnType<typeof setup>["db"];

	beforeEach(() => {
		({ adapter, db } = setup());
	});

	test("advertises no savepoints and no transactional DDL", () => {
		expect(adapter.capabilities.savepoints).toBe(false);
		expect(adapter.capabilities.transactionalDdl).toBe(false);
	});

	test("rejects a transaction scope, naming what the platform offers instead", async () => {
		let promise = db.transaction(async (tx) => {
			await tx.create(users, { id: 1, email: "first@example.com" });
		});

		await expect(promise).rejects.toThrow(/no transaction statements/);
	});

	test("makes no write at all when a transaction scope is refused", async () => {
		await expect(
			db.transaction(async (tx) => {
				await tx.create(users, { id: 1, email: "first@example.com" });
			}),
		).rejects.toThrow();

		expect(await db.count(users)).toBe(0);
	});

	test("rejects every commit, rollback and savepoint method too", async () => {
		let token = { id: "tx_1" };

		await expect(adapter.commitTransaction(token)).rejects.toThrow(/no transaction statements/);
		await expect(adapter.rollbackTransaction(token)).rejects.toThrow(/no transaction statements/);
		await expect(adapter.createSavepoint(token, "sp_1")).rejects.toThrow(
			/no transaction statements/,
		);
		await expect(adapter.rollbackToSavepoint(token, "sp_1")).rejects.toThrow(
			/no transaction statements/,
		);
		await expect(adapter.releaseSavepoint(token, "sp_1")).rejects.toThrow(
			/no transaction statements/,
		);
	});

	test("emits no transaction statement of its own, so ordinary writes land", async () => {
		await db.create(users, { id: 1, email: "first@example.com" });
		await db.create(users, { id: 2, email: "second@example.com" });

		expect(await db.count(users)).toBe(2);
	});

	test("leaves earlier writes in place when a later one fails, having opened no scope", async () => {
		await db.create(users, { id: 1, email: "first@example.com" });

		await expect(db.create(users, { id: 1, email: "conflict@example.com" })).rejects.toThrow();

		expect(await db.count(users)).toBe(1);
	});

	test("hands a transaction statement straight to the platform, which refuses it", async () => {
		let begun = await rejection(db.exec("BEGIN"));
		expect(String(begun.cause)).toContain("state.storage.transaction");

		let saved = await rejection(db.exec("SAVEPOINT sp_1"));
		expect(String(saved.cause)).toContain("state.storage.transaction");
	});

	test("executeScript applies a whole migration without wrapping it in a transaction", async () => {
		await adapter.executeScript(
			"CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT); CREATE INDEX posts_title ON posts (title)",
		);

		let result = await db.exec("SELECT name FROM sqlite_master WHERE type = ?", ["index"]);

		expect(result.rows).toEqual([{ name: "posts_title" }]);
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

		expect(off?.enabled).toBe(false);
		expect(on?.enabled).toBe(true);

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
