/**
 * Tests for the Durable Object `SqlStorage` mock: synchronous execution, single-pass
 * cursor semantics, refusal of the transaction-control statements the platform refuses,
 * and rejection of unsupported binding value types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "vitest";

import { createSqlStorage } from "./sql-storage.js";

/** Builds a storage with a `users` table ready to query. */
function setup(): SqlStorage {
	let sql = createSqlStorage();
	sql.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
	return sql;
}

describe("createSqlStorage", () => {
	let sql: SqlStorage;

	beforeEach(() => {
		sql = setup();
	});

	test("executes SQL synchronously and returns rows through the cursor", () => {
		sql.exec("INSERT INTO users (id, email) VALUES (?, ?)", 1, "a@example.com");

		let cursor = sql.exec("SELECT id, email FROM users");

		expect(cursor.columnNames).toEqual(["id", "email"]);
		expect(cursor.toArray()).toEqual([{ id: 1, email: "a@example.com" }]);
	});

	test("reads exactly one row with one(), and rejects any other count", () => {
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'a@example.com')");

		expect(sql.exec("SELECT email FROM users").one()).toEqual({ email: "a@example.com" });
		expect(() => sql.exec("SELECT email FROM users WHERE id = 99").one()).toThrow(
			/exactly one result/,
		);
	});

	test("advances row by row and reports done at the end", () => {
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'a'), (2, 'b')");

		let cursor = sql.exec("SELECT id FROM users ORDER BY id");

		expect(cursor.next()).toEqual({ value: { id: 1 } });
		expect(cursor.next()).toEqual({ value: { id: 2 } });
		expect(cursor.next()).toEqual({ done: true });
	});

	test("consumes the cursor once, so a second read yields nothing", () => {
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'a@example.com')");

		let cursor = sql.exec("SELECT id FROM users");

		expect(cursor.toArray()).toHaveLength(1);
		expect(cursor.toArray()).toHaveLength(0);
	});

	test("iterates rows as positional arrays through raw()", () => {
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'a@example.com')");

		expect([...sql.exec("SELECT id, email FROM users").raw()]).toEqual([[1, "a@example.com"]]);
	});

	test("is iterable, so a cursor can be spread", () => {
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'a@example.com')");

		expect([...sql.exec("SELECT id FROM users")]).toEqual([{ id: 1 }]);
	});

	test("reports rows written for writes and zero for reads", () => {
		let written = sql.exec("INSERT INTO users (id, email) VALUES (1, 'a'), (2, 'b')");
		expect(written.rowsWritten).toBe(2);

		let read = sql.exec("SELECT id FROM users");
		expect(read.rowsWritten).toBe(0);
		expect(read.toArray()).toHaveLength(2);
		expect(read.rowsRead).toBe(2);
	});

	test.each([
		"BEGIN",
		"BEGIN TRANSACTION",
		"BEGIN IMMEDIATE",
		"COMMIT",
		"ROLLBACK",
		"ROLLBACK TO SAVEPOINT sp_1",
		"SAVEPOINT sp_1",
		"RELEASE SAVEPOINT sp_1",
		"RELEASE sp_1",
	])("refuses %s the way the runtime refuses it", (statement) => {
		expect(() => sql.exec(statement)).toThrow(/use the state\.storage\.transaction\(\)/);
	});

	test("matches the keyword whatever its case, leading whitespace, or leading comment", () => {
		expect(() => sql.exec("  begin  ")).toThrow(/write coalescing/);
		expect(() => sql.exec("-- open the scope\nBeGiN")).toThrow(/write coalescing/);
		expect(() => sql.exec("/* open the scope */ commit")).toThrow(/write coalescing/);
	});

	test("refuses a transaction statement anywhere inside a script, not only at its head", () => {
		expect(() => sql.exec("CREATE TABLE a (x INTEGER); BEGIN; CREATE TABLE b (y INTEGER)")).toThrow(
			/write coalescing/,
		);
	});

	test("runs a migration that mentions a transaction keyword in a string or identifier", () => {
		sql.exec(`
			-- begin the schema
			CREATE TABLE "begin" (id INTEGER PRIMARY KEY, note TEXT DEFAULT 'commit; rollback');
			INSERT INTO "begin" (id, note) VALUES (1, 'savepoint; release');
			CREATE INDEX release_idx ON "begin" (note);
		`);

		expect(sql.exec('SELECT note FROM "begin"').one().note).toBe("savepoint; release");
	});

	test("runs a multi-statement script rather than dropping everything after the first", () => {
		sql.exec("CREATE TABLE a (x INTEGER); CREATE TABLE b (y INTEGER)");

		let tables = sql
			.exec("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name", "table")
			.toArray();

		expect(tables.map((row) => row.name)).toEqual(["a", "b", "users"]);
	});

	test("rejects a bound object, which the platform's binder does not accept", () => {
		expect(() => sql.exec("INSERT INTO users (id, email) VALUES (?, ?)", 1, { a: 1 })).toThrow(
			/not a supported binding value/,
		);
	});

	test("folds booleans to integers for convenience", () => {
		sql.exec("CREATE TABLE flags (id INTEGER PRIMARY KEY, enabled INTEGER)");
		sql.exec("INSERT INTO flags (id, enabled) VALUES (?, ?)", 1, true);

		expect(sql.exec("SELECT enabled FROM flags").one().enabled).toBe(1);
	});

	test("round-trips bytes through a BLOB column as an ArrayBuffer", () => {
		sql.exec("CREATE TABLE blobs (id INTEGER PRIMARY KEY, data BLOB)");
		sql.exec("INSERT INTO blobs (id, data) VALUES (?, ?)", 1, new TextEncoder().encode("bytes"));

		let data = sql.exec("SELECT data FROM blobs").one().data;

		expect(data).toBeInstanceOf(ArrayBuffer);
		expect(new TextDecoder().decode(data as ArrayBuffer)).toBe("bytes");
	});

	test("surfaces a malformed statement as an error", () => {
		expect(() => sql.exec("SELCT * FROM users")).toThrow();
	});

	test("reports a database size once pages exist", () => {
		expect(sql.databaseSize).toBeGreaterThan(0);
	});

	test("gives every storage its own isolated database", () => {
		let other = setup();
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'a@example.com')");

		expect(other.exec("SELECT COUNT(*) AS total FROM users").one().total).toBe(0);
	});
});
