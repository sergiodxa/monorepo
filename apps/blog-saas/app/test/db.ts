/**
 * In-memory {@link Database} harness for blog-saas unit tests. Applies the control-plane
 * D1 migration to a fresh database and wraps it with the shared SQLite `DatabaseDriver`
 * from `@pkg/blog-engine`, so models and services run against a real SQL engine
 * mirroring the production D1/SqlStorage adapters.
 *
 * The database is opened through `@pkg/cloudflare-mocks/sqlite`, which resolves to
 * whichever built-in SQLite module the running test runtime has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SqliteDatabase } from "@pkg/cloudflare-mocks/sqlite";

import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";
import { Database } from "remix/data-table";

// Raw SQL of the control-plane schema; run verbatim to match production D1.
import migration from "~/database/migrations/0001-init.sql?raw";

import { createBunSqliteDatabaseAdapter } from "../../../../packages/blog-engine/src/shared/test/db";

/** A live in-memory test database plus its underlying handle (call `close`). */
export interface TestDatabase {
	db: Database;
	sqliteDb: SqliteDatabase;
}

/**
 * Creates an isolated in-memory control-plane database with the D1 schema applied.
 * Each call returns a fresh database; remember to `sqliteDb.close()` when done.
 */
export function createTestDatabase(): TestDatabase {
	let sqliteDb = openDatabase(":memory:");
	sqliteDb.exec(migration);
	let db = new Database(createBunSqliteDatabaseAdapter(sqliteDb));
	return { db, sqliteDb };
}
