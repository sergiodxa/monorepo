/**
 * Applies a chain of SQL migrations the way `cf d1 migrations apply` does: in name order, each
 * once, recorded in the same `d1_migrations` table, so local and remote databases agree on
 * what ran whichever tool applied it. `dropTables` empties a database for the chain to rerun.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** The migration chain `sdxc make migration` writes into, relative to the project's root. */
export const MIGRATIONS_DIRECTORY = "database/migrations";

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

/** Every `.sql` file in the chain under `root`, with its SQL. */
export async function readMigrations(root: string): Promise<Migration[]> {
	let directory = join(root, MIGRATIONS_DIRECTORY);
	let names = (await readdir(directory)).filter((name) => name.endsWith(".sql"));
	return Promise.all(
		names.map(async (name) => ({ name, sql: await readFile(join(directory, name), "utf8") })),
	);
}

/** The table D1 records applied migrations in, as Wrangler and `cf` create it. */
const JOURNAL = `CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`;

/** Whether any migration ran on the database, which tells a new database from one in use. */
export function hasAppliedMigrations(database: MigrationDatabase): boolean {
	database.exec(JOURNAL);
	return database.query("SELECT 1 FROM d1_migrations LIMIT 1").all().length > 0;
}

/** The migrations the journal lacks, in the order `applyMigrations` runs them. */
export function pendingMigrations(
	database: MigrationDatabase,
	migrations: readonly Migration[],
): Migration[] {
	database.exec(JOURNAL);
	let rows = database.query("SELECT name FROM d1_migrations").all() as { name: string }[];
	let applied = new Set(rows.map((row) => row.name));
	return [...migrations]
		.filter((migration) => !applied.has(migration.name))
		.sort((a, b) => a.name.localeCompare(b.name));
}

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
	let names: string[] = [];
	for (let migration of pendingMigrations(database, migrations)) {
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

/** Tables SQLite and the local Workers runtime keep for themselves, which a reset leaves alone. */
const RESERVED_TABLE = /^(sqlite_|_cf_)/;

/**
 * Drops every view and table the migrations made, `d1_migrations` included, so the next
 * `applyMigrations` runs the whole chain on an empty database. Indexes and triggers go with
 * their tables, and foreign keys are off meanwhile, so the drop order never matters.
 *
 * @returns The names of the tables dropped, views left out.
 */
export function dropTables(database: MigrationDatabase): Result<string[], Error> {
	let rows = database
		.query(
			"SELECT type, name FROM sqlite_master WHERE type IN ('view', 'table') ORDER BY type DESC",
		)
		.all() as { type: "view" | "table"; name: string }[];
	let dropped = rows.filter((row) => !RESERVED_TABLE.test(row.name));
	let statements = dropped.map(
		(row) => `DROP ${row.type.toUpperCase()} IF EXISTS "${row.name.replaceAll('"', '""')}";`,
	);
	try {
		database.exec(
			`PRAGMA foreign_keys = OFF;\n${statements.join("\n")}\nPRAGMA foreign_keys = ON;`,
		);
	} catch (error) {
		return failure(new Error("Dropping the tables failed", { cause: error }));
	}
	return success(dropped.filter((row) => row.type === "table").map((row) => row.name));
}
