/**
 * Test-only database helper: applies every migration in `database/migrations/` to a
 * fresh in-memory SQLite database and wraps it the way the container wraps the
 * production one. Models, jobs, middleware and controllers therefore run against a
 * real SQL engine and the real schema rather than a mocked query layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SqliteDatabaseClient } from "remix/data-table/sqlite";

import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";
import { createSqliteDatabase } from "remix/data-table/sqlite";

/**
 * Applies every `.sql` migration in `database/migrations/`, filename-sorted — the same
 * order `wrangler d1 migrations apply` uses — to the given database.
 *
 * These are the files production has already applied, so a test schema cannot drift
 * from the live one without a migration saying so.
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
 * Opens an in-memory SQLite database as the client `createSqliteDatabase` takes.
 *
 * The database comes from `@pkg/cloudflare-mocks/sqlite`, which resolves to whichever
 * built-in SQLite module the running test runtime has and evens out the differences
 * between them. Its statements differ from the client surface in one place: `run()`
 * returns nothing, while the driver reads `changes`/`lastInsertRowid` off the result to
 * report a write's affected rows and insert id, so those are read back from the two
 * SQLite functions that hold them immediately after the statement runs.
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
