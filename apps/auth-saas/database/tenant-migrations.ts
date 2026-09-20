/**
 * The tenant object's schema migrations, and the runner it applies them with. SQL bodies
 * are inlined at build time because a Durable Object has no filesystem, and the runner
 * journals each one in the same turn it runs it, so an interrupted script never leaves a
 * journal row for work it did not finish.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DatabaseDriver } from "remix/data-table";

import { column as c, Database, table } from "remix/data-table";

import m0001 from "./tenant-migrations/0001-init.sql?raw";
import m0002 from "./tenant-migrations/0002-subjects.sql?raw";

/** One migration, identified so the journal can record that it ran. */
export interface Migration {
	id: string;
	sql: string;
}

/** Every migration, in the order they must be applied. */
export const MIGRATIONS: Migration[] = [
	{ id: "0001-init", sql: m0001 },
	{ id: "0002-subjects", sql: m0002 },
];

/** The journal `0001-init` creates, read back to find out what has already run. */
const schemaMigrations = table({
	name: "schema_migrations",
	primaryKey: ["id"],
	columns: { id: c.text(), applied_at: c.integer() },
});

/**
 * Applies whatever has not run yet against one tenant's database.
 *
 * Safe to call on every boot: an id already in the journal is skipped, so the cost for an
 * up-to-date object is a single read. The journal table is created ahead of the registry
 * itself, guarded, so a database with nothing applied yet still has somewhere to read
 * from; `0001-init` declares the same table again, also guarded, so the two never
 * disagree about its shape.
 *
 * Nothing here awaits real I/O between running a migration's script and recording that it
 * ran: both are `SqlStorage` calls with no network round trip, so they land in the
 * object's current turn and commit together. A script that throws leaves no journal row
 * for the work it did not finish, and the next boot retries it from its first statement.
 *
 * @param driver - The tenant's database.
 * @returns The ids applied by this call, empty when there was nothing to do.
 */
export async function runMigrations(driver: DatabaseDriver): Promise<{ applied: string[] }> {
	await driver.executeScript(
		"CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);",
	);

	let db = new Database(driver);
	let done = new Set((await db.findMany(schemaMigrations)).map((row) => row.id));

	let applied: string[] = [];
	for (let migration of MIGRATIONS) {
		if (done.has(migration.id)) continue;
		await driver.executeScript(migration.sql);
		await db.create(schemaMigrations, { id: migration.id, applied_at: Date.now() });
		applied.push(migration.id);
	}

	return { applied };
}
