/**
 * Tests for the Durable Object `SqlStorage` mock: synchronous execution, single-pass
 * cursor semantics, real `BEGIN`/`ROLLBACK` and savepoint atomicity, and rejection of
 * unsupported binding value types.
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

	test("rolls back a transaction issued as SQL", () => {
		sql.exec("BEGIN");
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'a@example.com')");
		sql.exec("ROLLBACK");

		expect(sql.exec("SELECT COUNT(*) AS total FROM users").one().total).toBe(0);
	});

	test("commits a transaction issued as SQL", () => {
		sql.exec("BEGIN");
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'a@example.com')");
		sql.exec("COMMIT");

		expect(sql.exec("SELECT COUNT(*) AS total FROM users").one().total).toBe(1);
	});

	test("rolls back to a savepoint without discarding the outer transaction", () => {
		sql.exec("BEGIN");
		sql.exec("INSERT INTO users (id, email) VALUES (1, 'outer@example.com')");
		sql.exec('SAVEPOINT "inner"');
		sql.exec("INSERT INTO users (id, email) VALUES (2, 'inner@example.com')");
		sql.exec('ROLLBACK TO SAVEPOINT "inner"');
		sql.exec("COMMIT");

		expect(sql.exec("SELECT id FROM users").toArray()).toEqual([{ id: 1 }]);
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
