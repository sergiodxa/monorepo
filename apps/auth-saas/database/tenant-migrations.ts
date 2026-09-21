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
import m0003 from "./tenant-migrations/0003-passwords.sql?raw";
import m0004 from "./tenant-migrations/0004-passkeys.sql?raw";
import m0005 from "./tenant-migrations/0005-sessions.sql?raw";
import m0006 from "./tenant-migrations/0006-signing-keys.sql?raw";
import m0007 from "./tenant-migrations/0007-clients.sql?raw";
import m0008 from "./tenant-migrations/0008-consent.sql?raw";
import m0009 from "./tenant-migrations/0009-authorization.sql?raw";
import m0010 from "./tenant-migrations/0010-tokens.sql?raw";
import m0011 from "./tenant-migrations/0011-mail-rate-limit.sql?raw";
import m0012 from "./tenant-migrations/0012-entitlements.sql?raw";
import m0013 from "./tenant-migrations/0013-dau.sql?raw";
import m0014 from "./tenant-migrations/0014-audit.sql?raw";
import m0015 from "./tenant-migrations/0015-totp.sql?raw";
import m0016 from "./tenant-migrations/0016-second-factor-sign-in.sql?raw";
import m0017 from "./tenant-migrations/0017-step-up.sql?raw";
import m0018 from "./tenant-migrations/0018-connections.sql?raw";
import m0019 from "./tenant-migrations/0019-connection-sign-in.sql?raw";
import m0020 from "./tenant-migrations/0020-saml-connections.sql?raw";

/** One migration, identified so the journal can record that it ran. */
export interface Migration {
	id: string;
	sql: string;
}

/** Every migration, in the order they must be applied. */
export const MIGRATIONS: Migration[] = [
	{ id: "0001-init", sql: m0001 },
	{ id: "0002-subjects", sql: m0002 },
	{ id: "0003-passwords", sql: m0003 },
	{ id: "0004-passkeys", sql: m0004 },
	{ id: "0005-sessions", sql: m0005 },
	{ id: "0006-signing-keys", sql: m0006 },
	{ id: "0007-clients", sql: m0007 },
	{ id: "0008-consent", sql: m0008 },
	{ id: "0009-authorization", sql: m0009 },
	{ id: "0010-tokens", sql: m0010 },
	{ id: "0011-mail-rate-limit", sql: m0011 },
	{ id: "0012-entitlements", sql: m0012 },
	{ id: "0013-dau", sql: m0013 },
	{ id: "0014-audit", sql: m0014 },
	{ id: "0015-totp", sql: m0015 },
	{ id: "0016-second-factor-sign-in", sql: m0016 },
	{ id: "0017-step-up", sql: m0017 },
	{ id: "0018-connections", sql: m0018 },
	{ id: "0019-connection-sign-in", sql: m0019 },
	{ id: "0020-saml-connections", sql: m0020 },
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
