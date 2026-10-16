/**
 * The local copy of the blog's D1 database, opened as the SQLite file `bun dev` keeps it in, so
 * a command reads and writes the rows the dev server serves. Miniflare names that file after the
 * `DB` binding's id in `wrangler.jsonc`, so it is found without starting the Worker runtime.
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

/** The part of `wrangler.jsonc` that names the D1 databases the Worker binds. */
const WRANGLER_D1 = s.object({
	d1_databases: s.array(
		s.object({ binding: s.string(), database_name: s.string(), database_id: s.string() }),
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
 * The `DB` binding as `wrangler.jsonc` declares it. A config that fails to parse, or binds no
 * `DB`, stops the command line at startup, since no database command could run without it.
 */
function readDatabaseBinding() {
	let text = readFileSync(join(PROJECT_ROOT, "wrangler.jsonc"), "utf8");
	let config = s.parse(WRANGLER_D1, unwrap(JSONC.parse(text)));
	let binding = config.d1_databases.find((database) => database.binding === "DB");
	if (binding === undefined) throw new Error("wrangler.jsonc binds no D1 database as DB");
	return binding;
}

/** The `DB` binding's entry in `wrangler.jsonc`, read once per run. */
const DATABASE = readDatabaseBinding();

/** The `DB` binding's database name, which `wrangler d1` commands address it by. */
export const DATABASE_NAME = DATABASE.database_name;

/** The `DB` binding's id, which Miniflare names the local SQLite file after. */
export const DATABASE_ID = DATABASE.database_id;

/** The SQLite file `bun dev` and `sdxc run db migrate` use for the `DB` binding. */
export const LOCAL_DATABASE_FILE = join(
	PROJECT_ROOT,
	".wrangler/state/v3/d1",
	NAMESPACE,
	`${objectId(NAMESPACE, DATABASE_ID)}.sqlite`,
);

/**
 * Opens the local database, creating the file where `bun dev` will find it when none exists yet.
 * Timestamps are written as ISO 8601 strings, as the Worker's database writes them.
 */
export function openLocalDatabase(filename = LOCAL_DATABASE_FILE): Database {
	if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
	return createSqliteDatabase({ filename }, { now: () => new Date().toISOString() });
}
