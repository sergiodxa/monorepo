/**
 * Test-only database helper: applies every migration in `database/migrations/` to a
 * fresh in-memory SQLite database and wraps it the way the container wraps the
 * production one. Models, jobs, middleware and controllers therefore run against a
 * real SQL engine and the real schema rather than a mocked query layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as SqliteDatabase } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createDatabase } from "remix/data-table";
import { createSqliteDatabaseAdapter } from "remix/data-table-sqlite";

/**
 * Applies every `.sql` migration in `database/migrations/`, filename-sorted — the same
 * order `wrangler d1 migrations apply` uses — to the given database.
 *
 * These are the files production has already applied, so a test schema cannot drift
 * from the live one without a migration saying so.
 *
 * @param sqliteDb - An open `bun:sqlite` database.
 */
export function applyMigrations(sqliteDb: SqliteDatabase): void {
	let files = readdirSync(migrationsDirectory())
		.filter((file) => file.endsWith(".sql"))
		.sort();

	for (let file of files) {
		sqliteDb.run(readFileSync(join(migrationsDirectory(), file), "utf8"));
	}
}

/** Absolute path of `database/migrations/`, resolved from this module rather than the cwd. */
function migrationsDirectory(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "../../../database/migrations");
}

/**
 * Creates an in-memory database with every migration applied, wrapped as a
 * `remix/data-table` `Database` configured exactly as the container configures the
 * production one — including the epoch-ms `now()`, without which written timestamps
 * would diverge from the integers the live rows hold.
 *
 * @returns The `db` handle and the underlying `bun:sqlite` instance.
 * @example
 * let { db } = createTestDatabase();
 */
export function createTestDatabase() {
	let sqliteDb = new SqliteDatabase(":memory:");
	applyMigrations(sqliteDb);

	let db = createDatabase(createSqliteDatabaseAdapter(sqliteDb), { now: () => Date.now() });

	return { db, sqliteDb };
}
