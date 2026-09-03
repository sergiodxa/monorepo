/**
 * Test-only database helper: applies every migration in `database/migrations/` to a fresh
 * in-memory SQLite database and wraps it the way the container wraps the production one.
 * Models, jobs, middleware and controllers therefore run against the same SQL engine and
 * schema production uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SqliteDatabaseClient } from "remix/data-table/sqlite";

import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { createSqliteDatabase } from "remix/data-table/sqlite";

/**
 * Applies every `.sql` migration in `database/migrations/`, filename-sorted the way
 * `wrangler d1 migrations apply` orders them, to the given database. These are the files
 * production has already applied, so a test schema cannot drift from the live one.
 *
 * @param sqliteDb - An open SQLite database.
 */
export function applyMigrations(sqliteDb: SqliteDatabaseClient): void {
	let files = readdirSync(migrationsDirectory())
		.filter((file) => file.endsWith(".sql"))
		.sort();

	for (let file of files) {
		sqliteDb.exec(readFileSync(join(migrationsDirectory(), file), "utf8"));
	}
}

/**
 * Opens an in-memory SQLite database as the client `createSqliteDatabase` takes, using
 * whichever built-in SQLite module the test runtime provides. Its `run()` returns nothing,
 * so affected rows and insert id are read back via two SQLite functions.
 *
 * @returns The open database.
 */
function openSqliteClient(): SqliteDatabaseClient {
	let database = openDatabase(":memory:");

	return {
		prepare(sql: string) {
			let statement = database.query(sql);

			return {
				get columnNames(): string[] {
					return statement.columnNames;
				},

				all(...values: unknown[]): unknown[] {
					return statement.all(...values);
				},

				get(...values: unknown[]): unknown {
					return statement.get(...values);
				},

				run(...values: unknown[]) {
					statement.run(...values);

					let changes = database.query("select changes() as changes").get() as {
						changes: number;
					};
					let inserted = database.query("select last_insert_rowid() as id").get() as {
						id: number;
					};

					return { changes: changes.changes, lastInsertRowid: inserted.id };
				},
			};
		},

		exec(sql: string): void {
			database.exec(sql);
		},
	};
}

/** Absolute path of `database/migrations/`, resolved relative to this module's own location. */
function migrationsDirectory(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "../../../database/migrations");
}

/**
 * Creates an in-memory database with every migration applied, configured exactly as the
 * container configures the production one, including the epoch-ms `now()` that keeps
 * written timestamps in step with the integers live rows hold.
 *
 * @returns The `db` handle and the underlying SQLite instance.
 * @example
 * let { db } = createTestDatabase();
 */
export function createTestDatabase() {
	let sqliteDb = openSqliteClient();
	applyMigrations(sqliteDb);

	let db = createSqliteDatabase(sqliteDb, { now: () => Date.now() });

	return { db, sqliteDb };
}
