/**
 * The local copy of the app's D1 database, opened as the SQLite file `bun dev` keeps it in, so a
 * command reads and writes the rows the dev server serves. Its name, id and migration chain come
 * from `wrangler.jsonc`, the same file Wrangler builds the local binding from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHash, createHmac } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Database } from "remix/data-table";

import * as JSONC from "@sdxc/jsonc";
import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createSqliteDatabase } from "remix/data-table/sqlite";

/** The Durable Object namespace Miniflare stores every local D1 database under. */
const NAMESPACE = "miniflare-D1DatabaseObject";

/** The binding the app's database is reached through, which picks its entry out of `d1_databases`. */
const DATABASE_BINDING = "DB";

/** The part of `wrangler.jsonc` a database command reads. */
const WRANGLER_CONFIG = s.object({
	d1_databases: s.array(
		s.object({
			binding: s.string(),
			database_name: s.string(),
			database_id: s.string(),
			migrations_dir: s.optional(s.string()),
		}),
	),
});

/**
 * Miniflare's object id for `name`: an HMAC-SHA256 of the name and an HMAC of that, both keyed by
 * the namespace's SHA-256 and cut to 16 bytes, so one database id always maps to one file.
 */
function objectId(namespace: string, name: string): string {
	let key = createHash("sha256").update(namespace).digest();
	let id = createHmac("sha256", key).update(name).digest().subarray(0, 16);
	let mac = createHmac("sha256", key).update(id).digest().subarray(0, 16);
	return Buffer.concat([id, mac]).toString("hex");
}

/** The project's root, which every path a command reads is resolved against. */
export const PROJECT_ROOT = join(import.meta.dirname, "../..");

/**
 * The `DB` entry in `wrangler.jsonc`. A config without one fails the command line at startup,
 * since every database command would answer for the wrong database.
 */
export const DATABASE = (() => {
	let text = readFileSync(join(PROJECT_ROOT, "wrangler.jsonc"), "utf8");
	let config = s.parse(WRANGLER_CONFIG, unwrap(JSONC.parse(text)));
	let entry = config.d1_databases.find((database) => database.binding === DATABASE_BINDING);
	if (entry === undefined) throw new Error(`wrangler.jsonc declares no ${DATABASE_BINDING}`);
	return {
		name: entry.database_name,
		id: entry.database_id,
		migrationsDirectory: entry.migrations_dir ?? "migrations",
	};
})();

/**
 * The SQLite file `bun dev` and `sdxc run db migrate` use for the `DB` binding. Miniflare names it
 * after `database_id`, so changing the id in `wrangler.jsonc` starts a fresh local copy.
 */
export const LOCAL_DATABASE_FILE = join(
	PROJECT_ROOT,
	".wrangler/state/v3/d1",
	NAMESPACE,
	`${objectId(NAMESPACE, DATABASE.id)}.sqlite`,
);

/**
 * Opens the local database, creating the file where `bun dev` will find it when none exists yet.
 * Timestamps are written as epoch milliseconds, as the Worker's connection writes them.
 */
export function openLocalDatabase(filename = LOCAL_DATABASE_FILE): Database {
	if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
	return createSqliteDatabase({ filename }, { now: () => Date.now() });
}
