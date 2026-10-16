/**
 * Applies a chain of SQL migrations the way `cf d1 migrations apply` does: in name order, each
 * once, recorded in the same `d1_migrations` table, so local and remote databases agree on
 * what ran whichever tool applied it.
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** One migration file: its name, as `0001_CreatePosts.sql`, and its SQL. */
export interface Migration {
	name: string;
	sql: string;
}

/** The synchronous SQLite client a migration runs on; it runs several statements per call. */
export interface MigrationDatabase {
	exec(sql: string): void;
	query(sql: string): { all(): unknown[] };
}

/** The table D1 records applied migrations in, as Wrangler and `cf` create it. */
const JOURNAL = `CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`;

/**
 * Runs every migration the journal lacks, each in its own transaction with its journal row, so
 * a failing migration leaves the database as the previous one left it.
 *
 * @returns The names applied, in order; a failure names the migration that stopped the run.
 */
export function applyMigrations(
	database: MigrationDatabase,
	migrations: readonly Migration[],
): Result<string[], Error> {
	database.exec(JOURNAL);
	let rows = database.query("SELECT name FROM d1_migrations").all() as { name: string }[];
	let applied = new Set(rows.map((row) => row.name));
	let pending = [...migrations]
		.filter((migration) => !applied.has(migration.name))
		.sort((a, b) => a.name.localeCompare(b.name));

	let names: string[] = [];
	for (let migration of pending) {
		try {
			database.exec(
				`BEGIN;\n${migration.sql}\n;INSERT INTO d1_migrations (name) VALUES ('${migration.name.replaceAll("'", "''")}');\nCOMMIT;`,
			);
		} catch (error) {
			database.exec("ROLLBACK");
			return failure(new Error(`${migration.name} failed`, { cause: error }));
		}
		names.push(migration.name);
	}
	return success(names);
}
