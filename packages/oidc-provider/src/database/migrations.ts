/**
 * Engine-owned schema migration runner.
 *
 * Holds the ordered list of `?raw` SQL migrations and applies the pending ones
 * against any host adapter (D1, SqlStorage, bun:sqlite), tracking progress in an
 * `oidc_migrations` journal so each migration runs exactly once per database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DatabaseDriver } from "remix/data-table";

import { column as c, Database, table } from "remix/data-table";

import m0001 from "../migrations/0001-init.sql?raw";
import m0002 from "../migrations/0002-add-authz-codes-client-index.sql?raw";
import m0003 from "../migrations/0003-add-pkce-to-webauthn-challenges.sql?raw";
import m0004 from "../migrations/0004-add-signing-keys-current-index.sql?raw";
import m0005 from "../migrations/0005-seed-dashboard-client.sql?raw";
import m0006 from "../migrations/0006-add-passkey-credential-id.sql?raw";
import m0007 from "../migrations/0007-browser-sessions-and-login-tokens.sql?raw";

/** An ordered, id-tagged schema migration (SQL is inlined at build/test time). */
interface OidcMigration {
	id: string;
	sql: string;
}

/**
 * Ordered engine migrations. SQL bodies are the same `?raw` files the provider
 * has always shipped; each host runs them through {@link runMigrations}.
 */
export const MIGRATIONS: OidcMigration[] = [
	{ id: "0001-init", sql: m0001 },
	{ id: "0002-add-authz-codes-client-index", sql: m0002 },
	{ id: "0003-add-pkce-to-webauthn-challenges", sql: m0003 },
	{ id: "0004-add-signing-keys-current-index", sql: m0004 },
	{ id: "0005-seed-dashboard-client", sql: m0005 },
	{ id: "0006-add-passkey-credential-id", sql: m0006 },
	{ id: "0007-browser-sessions-and-login-tokens", sql: m0007 },
];

/** Journal of applied migrations, so each runs exactly once per database. */
const journal = table({
	name: "oidc_migrations",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		applied_at: c.text(),
	},
});

/**
 * Applies pending migrations against the adapter, tracked in an `oidc_migrations`
 * journal table. Idempotent: already-applied ids are skipped, so it is safe to
 * run on every cold start. Multi-statement SQL is executed via `executeScript`,
 * which each adapter (D1, SqlStorage, bun:sqlite) handles.
 * @param adapter - The database adapter to migrate.
 * @returns The ids applied in this run.
 * @example
 * let { applied } = await runMigrations(config.database);
 */
export async function runMigrations(adapter: DatabaseDriver): Promise<{ applied: string[] }> {
	await adapter.executeScript(
		"CREATE TABLE IF NOT EXISTS oidc_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);",
	);

	let db = new Database(adapter);
	let existing = await db.findMany(journal);
	let done = new Set(existing.map((row) => row.id));

	let applied: string[] = [];
	for (let migration of MIGRATIONS) {
		if (done.has(migration.id)) continue;
		await adapter.executeScript(migration.sql);
		await db.create(journal, { id: migration.id, applied_at: new Date().toISOString() });
		applied.push(migration.id);
	}

	return { applied };
}
