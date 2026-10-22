/**
 * The migration runner, on an in-memory SQLite database shaped like a local D1 copy.
 */

import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import {
	applyMigrations,
	dropTables,
	hasAppliedMigrations,
	pendingMigrations,
} from "~/app/services/migrations";

/** Two migrations, given out of order to show the runner sorts them. */
const MIGRATIONS = [
	{ name: "0002_AddTitle.sql", sql: "ALTER TABLE posts ADD COLUMN title TEXT;" },
	{ name: "0001_CreatePosts.sql", sql: "CREATE TABLE posts (id TEXT PRIMARY KEY);" },
];

describe("applyMigrations", () => {
	test("applies each pending migration once, in name order", () => {
		let database = openDatabase(":memory:");

		let first = unwrap(applyMigrations(database, MIGRATIONS));
		let second = unwrap(applyMigrations(database, MIGRATIONS));

		expect(first).toEqual(["0001_CreatePosts.sql", "0002_AddTitle.sql"]);
		expect(second).toEqual([]);
		expect(database.query("SELECT name FROM d1_migrations ORDER BY id").all()).toEqual([
			{ name: "0001_CreatePosts.sql" },
			{ name: "0002_AddTitle.sql" },
		]);
	});

	test("stops at a failing migration and leaves it unrecorded", () => {
		let database = openDatabase(":memory:");

		let result = applyMigrations(database, [
			...MIGRATIONS,
			{ name: "0003_Broken.sql", sql: "CREATE TABLE posts (id TEXT);" },
		]);

		expect(isFailure(result) && result.error.message).toBe("0003_Broken.sql failed");
		expect(database.query("SELECT count(*) AS applied FROM d1_migrations").all()).toEqual([
			{ applied: 2 },
		]);
	});
});

describe("pendingMigrations", () => {
	test("lists what applyMigrations would run, and applies nothing", () => {
		let database = openDatabase(":memory:");
		unwrap(applyMigrations(database, MIGRATIONS.slice(1)));

		let pending = pendingMigrations(database, MIGRATIONS);

		expect(pending.map((migration) => migration.name)).toEqual(["0002_AddTitle.sql"]);
		expect(database.query("SELECT count(*) AS applied FROM d1_migrations").all()).toEqual([
			{ applied: 1 },
		]);
	});
});

describe("dropTables", () => {
	test("drops the migrations' tables and views, and the journal, so the chain runs again", () => {
		let database = openDatabase(":memory:");
		unwrap(applyMigrations(database, MIGRATIONS));
		database.exec(
			"CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id TEXT REFERENCES posts (id)); CREATE VIEW titles AS SELECT title FROM posts;",
		);

		let dropped = unwrap(dropTables(database));

		expect(dropped.toSorted()).toEqual(["comments", "d1_migrations", "posts"]);
		expect(
			database.query("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all(),
		).toEqual([]);
		expect(unwrap(applyMigrations(database, MIGRATIONS))).toHaveLength(2);
	});
});

describe("hasAppliedMigrations", () => {
	test("tells a new database from one a migration ran on", () => {
		let database = openDatabase(":memory:");
		let before = hasAppliedMigrations(database);
		unwrap(applyMigrations(database, MIGRATIONS));

		expect([before, hasAppliedMigrations(database)]).toEqual([false, true]);
	});
});
