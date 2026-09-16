/**
 * The reader's schema migrations, and the runner both object types apply theirs with.
 * SQL bodies are inlined at build time because a Durable Object has no filesystem, and
 * the runner is journaled so a cold start can call it unconditionally.
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
import m0005 from "./migrations/0005-feed-title-index.sql?raw";
import m0006 from "./migrations/0006-shared-feed-objects.sql?raw";
import m0007 from "./migrations/0007-folders.sql?raw";
import m0008 from "./migrations/0008-tier.sql?raw";
import m0009 from "./migrations/0009-schedule.sql?raw";
import m0010 from "./migrations/0010-tags-and-pins.sql?raw";
import m0011 from "./migrations/0011-filter-rules.sql?raw";
import m0012 from "./migrations/0012-notifications.sql?raw";
import m0014 from "./migrations/0014-searches.sql?raw";
import m0015 from "./migrations/0015-presentation.sql?raw";
import m0016 from "./migrations/0016-keep-link-parameters.sql?raw";
import m0017 from "./migrations/0017-agent-tokens.sql?raw";

/** One migration, identified so the journal can record that it ran. */
export interface Migration {
	id: string;
	sql: string;
}

/** Every migration, in the order they must be applied. */
export const MIGRATIONS: Migration[] = [
	{ id: "0001-init", sql: m0001 },
	{ id: "0002-drop-item-content", sql: m0002 },
	{ id: "0003-feed-list-index", sql: m0003 },
	{ id: "0004-read-timeline-index", sql: m0004 },
	{ id: "0005-feed-title-index", sql: m0005 },
	{ id: "0006-shared-feed-objects", sql: m0006 },
	{ id: "0007-folders", sql: m0007 },
	{ id: "0008-tier", sql: m0008 },
	{ id: "0009-schedule", sql: m0009 },
	{ id: "0010-tags-and-pins", sql: m0010 },
	{ id: "0011-filter-rules", sql: m0011 },
	{ id: "0012-notifications", sql: m0012 },
	{ id: "0014-searches", sql: m0014 },
	{ id: "0015-presentation", sql: m0015 },
	{ id: "0016-keep-link-parameters", sql: m0016 },
	{ id: "0017-agent-tokens", sql: m0017 },
];

/**
 * The journal the reader's own migrations are recorded in. Named for this app rather
 * than taking the data table's default, so adopting its own migration runner later
 * cannot collide with the ids this one has already written.
 */
export const READER_JOURNAL = "reader_migrations";

/** The journal, as a table to read the applied ids back out of. */
function journalTable(name: string) {
	return table({
		name,
		primaryKey: ["id"],
		columns: { id: c.text(), applied_at: c.text() },
	});
}

/**
 * Applies whatever has not run yet against one database.
 *
 * Safe to call on every boot: an id already in the journal is skipped, so the cost
 * for an up-to-date object is a single read.
 *
 * Each object type passes its own migrations and its own journal name, so the two
 * schemas are applied independently and neither can skip a migration because the
 * other had already recorded that id.
 *
 * @param adapter - The database to migrate
 * @param migrations - The migrations to apply, in order; defaults to the reader's
 * @param journalName - Where applied ids are recorded; defaults to the reader's
 * @returns The ids applied by this call, empty when there was nothing to do
 */
export async function runMigrations(
	adapter: DatabaseDriver,
	migrations: Migration[] = MIGRATIONS,
	journalName: string = READER_JOURNAL,
): Promise<{ applied: string[] }> {
	await adapter.executeScript(
		`CREATE TABLE IF NOT EXISTS ${journalName} (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`,
	);

	let journal = journalTable(journalName);
	let db = new Database(adapter);
	let done = new Set((await db.findMany(journal)).map((row) => row.id));

	let applied: string[] = [];
	for (let migration of migrations) {
		if (done.has(migration.id)) continue;
		await adapter.executeScript(migration.sql);
		await db.create(journal, { id: migration.id, applied_at: new Date().toISOString() });
		applied.push(migration.id);
	}

	return { applied };
}
