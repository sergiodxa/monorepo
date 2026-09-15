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

import { splitSqlStatements } from "./sql-script.js";

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

	test("executeScript keeps a comment's semicolon out of the split, so the DDL behind it runs", async () => {
		await adapter.executeScript(`
			-- The ordering the subscription list reads in: it pages by keyset on (created_at, id),
			-- and that seek is a seek only while an index carries both keys, in that order.
			CREATE TABLE feeds (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL);
			CREATE INDEX feeds_subscription_idx ON feeds (created_at, id);
		`);

		let result = await db.exec("SELECT name FROM sqlite_master WHERE type = ?", ["index"]);

		expect(result.rows).toEqual([{ name: "feeds_subscription_idx" }]);
	});

	test("executeScript stores a string literal holding a semicolon whole", async () => {
		await adapter.executeScript(`
			CREATE TABLE labels (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
			INSERT INTO labels (id, label) VALUES (1, 'first; second');
		`);

		let result = await db.exec("SELECT label FROM labels");

		expect(result.rows).toEqual([{ label: "first; second" }]);
	});

	test("executeScript creates a trigger whose body carries its own semicolons", async () => {
		await adapter.executeScript(`
			CREATE TABLE totals (id INTEGER PRIMARY KEY, n INTEGER NOT NULL, note TEXT);
			INSERT INTO totals (id, n, note) VALUES (1, 0, 'start');
			CREATE TABLE events (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
			CREATE TRIGGER events_counted AFTER INSERT ON events BEGIN
				UPDATE totals SET n = CASE WHEN n < 10 THEN n + 1 ELSE n END;
				UPDATE totals SET note = 'seen; noted';
			END;
		`);

		await db.exec("INSERT INTO events (id, label) VALUES (1, ?)", ["first"]);

		let result = await db.exec("SELECT n, note FROM totals");

		expect(result.rows).toEqual([{ n: 1, note: "seen; noted" }]);
	});

	test("executeScript reads a BEGIN inside a literal or a comment as neither", async () => {
		await adapter.executeScript(`
			-- BEGIN; the platform refuses that statement, and this is a comment.
			CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL);
			INSERT INTO notes (id, body) VALUES (1, 'BEGIN; COMMIT');
		`);

		let result = await db.exec("SELECT body FROM notes");

		expect(result.rows).toEqual([{ body: "BEGIN; COMMIT" }]);
	});

	test("executeScript hands a real BEGIN to the platform, which refuses it", async () => {
		await expect(
			adapter.executeScript("BEGIN; CREATE TABLE notes (id INTEGER PRIMARY KEY)"),
		).rejects.toThrow(/state\.storage\.transaction/);
	});

	test("executeScript names an unterminated literal instead of running a fragment of it", async () => {
		await expect(
			adapter.executeScript(
				"CREATE TABLE notes (id INTEGER PRIMARY KEY);\nINSERT INTO notes VALUES ('oops);",
			),
		).rejects.toThrow(/unterminated string literal opened on line 2/);
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

describe("splitSqlStatements", () => {
	test("splits a script on the semicolons that terminate its statements", () => {
		expect(splitSqlStatements("SELECT 1; SELECT 2")).toEqual(["SELECT 1", "SELECT 2"]);
	});

	test("keeps a final statement that carries no trailing semicolon", () => {
		expect(splitSqlStatements("SELECT 1;\nSELECT 2")).toEqual(["SELECT 1", "SELECT 2"]);
	});

	test("yields nothing for the empty statements a doubled semicolon leaves", () => {
		expect(splitSqlStatements("SELECT 1;;\n  ; ")).toEqual(["SELECT 1"]);
	});

	test("keeps a semicolon inside a single-quoted literal", () => {
		expect(splitSqlStatements("INSERT INTO t VALUES ('first; second')")).toEqual([
			"INSERT INTO t VALUES ('first; second')",
		]);
	});

	test("reads a doubled quote as an escape rather than the end of the literal", () => {
		expect(splitSqlStatements("INSERT INTO t VALUES ('it''s; here'); SELECT 1")).toEqual([
			"INSERT INTO t VALUES ('it''s; here')",
			"SELECT 1",
		]);
	});

	test("keeps a semicolon inside a double-quoted identifier", () => {
		expect(splitSqlStatements('SELECT "a;b" FROM t; SELECT 1')).toEqual([
			'SELECT "a;b" FROM t',
			"SELECT 1",
		]);
	});

	test("reads a doubled double quote as an escape inside an identifier", () => {
		expect(splitSqlStatements('SELECT "a""b;c" FROM t; SELECT 1')).toEqual([
			'SELECT "a""b;c" FROM t',
			"SELECT 1",
		]);
	});

	test("keeps a semicolon inside a backtick-quoted identifier", () => {
		expect(splitSqlStatements("SELECT `a;b` FROM t; SELECT 1")).toEqual([
			"SELECT `a;b` FROM t",
			"SELECT 1",
		]);
	});

	test("keeps a semicolon inside a bracketed identifier", () => {
		expect(splitSqlStatements("SELECT [a;b] FROM t; SELECT 1")).toEqual([
			"SELECT [a;b] FROM t",
			"SELECT 1",
		]);
	});

	test("keeps a semicolon inside a line comment, with the statement it introduces", () => {
		let script =
			"-- pages by keyset on (created_at, id); sorting is the cost\nCREATE INDEX i ON t (a)";

		expect(splitSqlStatements(script)).toEqual([script]);
	});

	test("keeps a semicolon inside a block comment", () => {
		expect(splitSqlStatements("/* a; b */ SELECT 1; SELECT 2")).toEqual([
			"/* a; b */ SELECT 1",
			"SELECT 2",
		]);
	});

	test("drops a fragment that holds only comments and whitespace", () => {
		expect(splitSqlStatements("SELECT 1;\n-- done\n")).toEqual(["SELECT 1"]);
	});

	test("keeps a CREATE TRIGGER whole, body semicolons and CASE included", () => {
		let trigger =
			"CREATE TRIGGER t AFTER INSERT ON x BEGIN\n" +
			"\tUPDATE y SET n = CASE WHEN n < 10 THEN n + 1 ELSE n END;\n" +
			"\tUPDATE y SET note = 'seen; noted';\n" +
			"END";

		expect(splitSqlStatements(trigger + ";\nSELECT 1")).toEqual([trigger, "SELECT 1"]);
	});

	test("reads the statement after a trigger as its own", () => {
		expect(
			splitSqlStatements(
				"CREATE TRIGGER t AFTER INSERT ON x BEGIN UPDATE y SET n = 1; END; DROP TABLE z",
			),
		).toEqual(["CREATE TRIGGER t AFTER INSERT ON x BEGIN UPDATE y SET n = 1; END", "DROP TABLE z"]);
	});

	test("reads a BEGIN outside a trigger as the statement it is", () => {
		expect(splitSqlStatements("BEGIN; SELECT 1")).toEqual(["BEGIN", "SELECT 1"]);
	});

	test("names an unterminated string literal and the line it opened on", () => {
		expect(() => splitSqlStatements("SELECT 1;\nINSERT INTO t VALUES ('oops);\n")).toThrow(
			/unterminated string literal opened on line 2/,
		);
	});

	test("names an unterminated bracketed identifier", () => {
		expect(() => splitSqlStatements("SELECT [a FROM t")).toThrow(
			/unterminated bracketed identifier opened on line 1/,
		);
	});

	test("names an unterminated block comment", () => {
		expect(() => splitSqlStatements("SELECT 1;\n/* note\nSELECT 2")).toThrow(
			/unterminated block comment opened on line 2/,
		);
	});

	test("names a trigger body that never closes with END", () => {
		expect(() =>
			splitSqlStatements(
				"CREATE TABLE x (id INTEGER);\nCREATE TRIGGER t AFTER INSERT ON x BEGIN\n\tUPDATE y SET n = 1;\n",
			),
		).toThrow(/CREATE TRIGGER body opened on line 2 that never closes with END/);
	});
});
