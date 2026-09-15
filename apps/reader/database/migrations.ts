/**
 * The reader's schema migrations and the runner that applies them. SQL bodies are
 * inlined at build time because a Durable Object has no filesystem, and the runner
 * is journaled so a cold start can call it unconditionally.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DatabaseDriver } from "remix/data-table";

import { column as c, Database, table } from "remix/data-table";

import m0001 from "./migrations/0001-init.sql?raw";
import m0002 from "./migrations/0002-drop-item-content.sql?raw";
import m0003 from "./migrations/0003-feed-list-index.sql?raw";
import m0004 from "./migrations/0004-read-timeline-index.sql?raw";

/** One migration, identified so the journal can record that it ran. */
interface ReaderMigration {
	id: string;
	sql: string;
}

/** Every migration, in the order they must be applied. */
export const MIGRATIONS: ReaderMigration[] = [
	{ id: "0001-init", sql: m0001 },
	{ id: "0002-drop-item-content", sql: m0002 },
	{ id: "0003-feed-list-index", sql: m0003 },
	{ id: "0004-read-timeline-index", sql: m0004 },
];

/**
 * The journal of applied migrations. Named for this app rather than taking the data
 * table's default, so adopting its own migration runner later cannot collide with
 * the ids this one has already written.
 */
const journal = table({
	name: "reader_migrations",
	primaryKey: ["id"],
	columns: { id: c.text(), applied_at: c.text() },
});

/**
 * Applies whatever has not run yet against one database.
 *
 * Safe to call on every boot: an id already in the journal is skipped, so the cost
 * for an up-to-date object is a single read.
 *
 * @param adapter - The database to migrate
 * @returns The ids applied by this call, empty when there was nothing to do
 */
export async function runMigrations(adapter: DatabaseDriver): Promise<{ applied: string[] }> {
	await adapter.executeScript(
		"CREATE TABLE IF NOT EXISTS reader_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);",
	);

	let db = new Database(adapter);
	let done = new Set((await db.findMany(journal)).map((row) => row.id));

	let applied: string[] = [];
	for (let migration of MIGRATIONS) {
		if (done.has(migration.id)) continue;
		await adapter.executeScript(migration.sql);
		await db.create(journal, { id: migration.id, applied_at: new Date().toISOString() });
		applied.push(migration.id);
	}

	return { applied };
}
