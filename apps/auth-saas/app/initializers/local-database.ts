/**
 * The local copy of the control-plane D1 database, opened as the SQLite file `bun dev` keeps it
 * in, so a command reads and writes the rows the dev server serves. Miniflare names that file
 * after the `PLATFORM_DB` database id in `wrangler.jsonc`, so it is found without starting workerd.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHmac, createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Database } from "remix/data-table";

import * as JSONC from "@sdxc/jsonc";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createSqliteDatabase } from "remix/data-table/sqlite";

/** The Durable Object namespace Miniflare stores every local D1 database under. */
const NAMESPACE = "miniflare-D1DatabaseObject";

/** The binding the control plane's database is declared under in `wrangler.jsonc`. */
const BINDING = "PLATFORM_DB";

/** The part of `wrangler.jsonc` naming the Worker's D1 databases. */
const WRANGLER_CONFIG_SCHEMA = s.object({
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

/**
 * The `PLATFORM_DB` entry of `wrangler.jsonc`. A config that fails to parse or lacks the binding
 * yields the names Wrangler would report as unknown, so a command fails on Wrangler's own message.
 */
function readPlatformDatabase(root: string): { name: string; id: string } {
	let parsed = JSONC.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8"));
	let config = isFailure(parsed) ? null : s.parseSafe(WRANGLER_CONFIG_SCHEMA, parsed.data);
	let entry = config?.success
		? config.value.d1_databases.find((database) => database.binding === BINDING)
		: undefined;
	return { name: entry?.database_name ?? BINDING, id: entry?.database_id ?? BINDING };
}

/** The project's root, which every path a command reads is resolved against. */
export const PROJECT_ROOT = join(import.meta.dirname, "../..");

/** The `PLATFORM_DB` database's name and id, as `wrangler.jsonc` declares them. */
export const PLATFORM_DATABASE = readPlatformDatabase(PROJECT_ROOT);

/** The SQLite file `bun dev` and `sdxc run db migrate` use for the `PLATFORM_DB` binding. */
export const LOCAL_DATABASE_FILE = join(
	PROJECT_ROOT,
	".wrangler/state/v3/d1",
	NAMESPACE,
	`${objectId(NAMESPACE, PLATFORM_DATABASE.id)}.sqlite`,
);

/**
 * Opens the local database, creating the file where `bun dev` will find it when none exists yet.
 * Timestamps are written as epoch milliseconds, as the Worker's database writes them.
 */
export function openLocalDatabase(filename = LOCAL_DATABASE_FILE): Database {
	if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
	return createSqliteDatabase({ filename }, { now: () => Date.now() });
}
