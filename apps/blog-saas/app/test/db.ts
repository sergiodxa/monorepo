/**
 * In-memory `bun:sqlite` {@link Database} harness for blog-saas unit tests. Applies
 * the control-plane D1 migration to a fresh database and wraps it with the shared
 * `bun:sqlite` `DatabaseAdapter` from `@pkg/blog-engine`, so models and services run
 * against a real SQL engine mirroring the production D1/SqlStorage adapters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Database as Sqlite } from "bun:sqlite";

import { type Database, createDatabase } from "remix/data-table";

// Raw SQL of the control-plane schema; run verbatim to match production D1.
import migration from "~/database/migrations/0001-init.sql?raw";

import { createBunSqliteDatabaseAdapter } from "../../../../packages/blog-engine/src/shared/test/db";

/** A live in-memory test database plus its underlying handle (call `close`). */
export interface TestDatabase {
	db: Database;
	sqliteDb: Sqlite;
}

/**
 * Creates an isolated in-memory control-plane database with the D1 schema applied.
 * Each call returns a fresh database; remember to `sqliteDb.close()` when done.
 */
export function createTestDatabase(): TestDatabase {
	let sqliteDb = new Sqlite(":memory:");
	sqliteDb.run(migration);
	let db = createDatabase(createBunSqliteDatabaseAdapter(sqliteDb));
	return { db, sqliteDb };
}
