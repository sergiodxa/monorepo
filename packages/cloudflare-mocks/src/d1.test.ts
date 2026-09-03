/**
 * Tests for the D1 mock. They exist to prove SQL really executes: statements are parsed by
 * SQLite, metadata comes from the engine, `batch` is atomic, and the binder rejects the
 * types real D1 rejects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "vitest";

import { createD1Database } from "./d1.js";

/** Builds a database with a `users` table ready to query. */
async function setup(): Promise<D1Database> {
	let db = createD1Database();
	await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
	return db;
}

describe("createD1Database", () => {
	let db: D1Database;

	beforeEach(async () => {
		db = await setup();
	});

	test("executes real SQL and reads the rows back", async () => {
		await db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").bind(1, "a@example.com").run();

		let result = await db.prepare("SELECT id, email FROM users WHERE id = ?").bind(1).all();

		expect(result.success).toBe(true);
		expect(result.results).toEqual([{ id: 1, email: "a@example.com" }]);
	});

	test("rejects a malformed statement instead of returning canned rows", async () => {
		await expect(db.prepare("SELCT * FROM users").all()).rejects.toThrow();
	});

	test("rejects a statement referencing a column that does not exist", async () => {
		await expect(db.prepare("SELECT nope FROM users").all()).rejects.toThrow();
	});

	test("surfaces constraint violations from the engine", async () => {
		let insert = db.prepare("INSERT INTO users (id, email) VALUES (?, ?)");
		await insert.bind(1, "a@example.com").run();

		await expect(insert.bind(1, "b@example.com").run()).rejects.toThrow();
	});

	test("reports changes, last_row_id, and rows_read in meta", async () => {
		let inserted = await db
			.prepare("INSERT INTO users (id, email) VALUES (?, ?)")
			.bind(7, "seven@example.com")
			.run();

		expect(inserted.meta.changes).toBe(1);
		expect(inserted.meta.last_row_id).toBe(7);
		expect(inserted.meta.rows_written).toBe(1);
		expect(inserted.meta.changed_db).toBe(true);

		let selected = await db.prepare("SELECT * FROM users").all();

		expect(selected.meta.changes).toBe(0);
		expect(selected.meta.rows_read).toBe(1);
	});

	test("counts every row an UPDATE touched", async () => {
		await db.prepare("INSERT INTO users (id, email) VALUES (1, 'a'), (2, 'b')").run();

		let updated = await db.prepare("UPDATE users SET email = ?").bind("same").run();

		expect(updated.meta.changes).toBe(2);
	});

	test("returns rows from a RETURNING clause", async () => {
		let result = await db
			.prepare("INSERT INTO users (id, email) VALUES (?, ?) RETURNING email")
			.bind(3, "three@example.com")
			.all<{ email: string }>();

		expect(result.results).toEqual([{ email: "three@example.com" }]);
		expect(result.meta.changes).toBe(1);
	});

	test("reads the first row, or one of its columns", async () => {
		await db.prepare("INSERT INTO users (id, email) VALUES (1, 'a@example.com')").run();

		let row = await db.prepare("SELECT * FROM users").first();
		expect(row).toEqual({ id: 1, email: "a@example.com" });

		expect(await db.prepare("SELECT * FROM users").first<string>("email")).toBe("a@example.com");

		let missing = await db.prepare("SELECT * FROM users WHERE id = 99").first();
		expect(missing).toBeNull();
	});

	test("returns raw rows, optionally prefixed with column names", async () => {
		await db.prepare("INSERT INTO users (id, email) VALUES (1, 'a@example.com')").run();

		expect(await db.prepare("SELECT id, email FROM users").raw()).toEqual([[1, "a@example.com"]]);
		expect(await db.prepare("SELECT id, email FROM users").raw({ columnNames: true })).toEqual([
			["id", "email"],
			[1, "a@example.com"],
		]);
	});

	test("keeps bind non-mutating, so a prepared statement can be reused", async () => {
		let insert = db.prepare("INSERT INTO users (id, email) VALUES (?, ?)");

		await insert.bind(1, "one@example.com").run();
		await insert.bind(2, "two@example.com").run();

		let result = await db.prepare("SELECT COUNT(*) AS total FROM users").first<number>("total");
		expect(result).toBe(2);
	});

	test("runs a batch atomically, rolling back when one statement fails", async () => {
		let promise = db.batch([
			db.prepare("INSERT INTO users (id, email) VALUES (1, 'a@example.com')"),
			db.prepare("INSERT INTO users (id, email) VALUES (1, 'duplicate@example.com')"),
		]);

		await expect(promise).rejects.toThrow();

		let count = await db.prepare("SELECT COUNT(*) AS total FROM users").first<number>("total");
		expect(count).toBe(0);
	});

	test("returns one result per batch statement when the batch succeeds", async () => {
		let results = await db.batch([
			db.prepare("INSERT INTO users (id, email) VALUES (1, 'a@example.com')"),
			db.prepare("SELECT email FROM users"),
		]);

		expect(results).toHaveLength(2);
		expect(results[1]?.results).toEqual([{ email: "a@example.com" }]);
	});

	test("rejects a bound object, the way D1's binder does", async () => {
		let statement = db
			.prepare("INSERT INTO users (id, email) VALUES (?, ?)")
			.bind(1, { nested: true });

		await expect(statement.run()).rejects.toThrow(/D1_TYPE_ERROR/);
		await expect(statement.run()).rejects.toThrow(/\{"nested":true\}/);
	});

	test("rejects a bound undefined, which D1 does not accept", async () => {
		let statement = db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").bind(1, undefined);

		await expect(statement.run()).rejects.toThrow(/D1_TYPE_ERROR/);
	});

	test("folds booleans to integers, as D1 does", async () => {
		await db.exec("CREATE TABLE flags (id INTEGER PRIMARY KEY, enabled INTEGER)");
		await db.prepare("INSERT INTO flags (id, enabled) VALUES (?, ?)").bind(1, true).run();

		expect(await db.prepare("SELECT enabled FROM flags").first<number>("enabled")).toBe(1);
	});

	test("round-trips bytes through a BLOB column as an ArrayBuffer", async () => {
		await db.exec("CREATE TABLE blobs (id INTEGER PRIMARY KEY, data BLOB)");
		await db
			.prepare("INSERT INTO blobs (id, data) VALUES (?, ?)")
			.bind(1, new TextEncoder().encode("bytes").buffer)
			.run();

		let data = await db.prepare("SELECT data FROM blobs").first<ArrayBuffer>("data");

		expect(new TextDecoder().decode(data as ArrayBuffer)).toBe("bytes");
	});

	test("rejects a prepared statement holding more than one statement", async () => {
		await expect(db.prepare("SELECT 1; SELECT 2").all()).rejects.toThrow(/only one statement/);
	});

	test("runs a multi-statement script through exec", async () => {
		let result = await db.exec(
			"CREATE TABLE posts (id INTEGER PRIMARY KEY); CREATE INDEX posts_id ON posts (id)",
		);

		expect(result.count).toBe(2);

		let indexes = await db
			.prepare("SELECT name FROM sqlite_master WHERE type = ?")
			.bind("index")
			.all<{ name: string }>();

		expect(indexes.results).toEqual([{ name: "posts_id" }]);
	});

	test("keeps a semicolon inside a string literal in the same statement", async () => {
		await db.prepare("INSERT INTO users (id, email) VALUES (1, 'a;b@example.com')").run();

		expect(await db.prepare("SELECT email FROM users").first<string>("email")).toBe(
			"a;b@example.com",
		);
	});

	test("reports null until a session has run a query", async () => {
		let session = db.withSession();

		expect(session.getBookmark()).toBeNull();

		await session.batch([session.prepare("SELECT 1 AS one")]);

		expect(session.getBookmark()).toBeTypeOf("string");
	});

	test("gives every database its own isolated storage", async () => {
		let other = await setup();
		await db.prepare("INSERT INTO users (id, email) VALUES (1, 'a@example.com')").run();

		let count = await other.prepare("SELECT COUNT(*) AS total FROM users").first<number>("total");
		expect(count).toBe(0);
	});
	test("drops every schema object on reset, so a shared binding starts each test clean", async () => {
		let db = createD1Database();
		await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
		await db.exec("CREATE INDEX users_email ON users (email)");
		await db.prepare("INSERT INTO users VALUES (?, ?)").bind(1, "ada@example.com").run();

		db.reset();

		await expect(db.prepare("SELECT * FROM users").all()).rejects.toThrow(/no such table/);
		await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
		expect((await db.prepare("SELECT * FROM users").all()).results).toHaveLength(0);
	});
});
