/**
 * The local copy of the app's D1 database, opened as the SQLite file `bun dev` keeps it in, so a
 * command reads and writes the rows the dev server serves. Miniflare names that file after the
 * database id in `cloudflare.config.ts`, so it is found without starting the Worker runtime.
 */

import { createHmac, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Database } from "remix/data-table";

import { createSqliteDatabase } from "remix/data-table/sqlite";

import config from "../../cloudflare.config";
import manifest from "../../package.json" with { type: "json" };

/** The Durable Object namespace Miniflare stores every local D1 database under. */
const NAMESPACE = "miniflare-D1DatabaseObject";

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

/** The `DB` binding's id, as `cloudflare.config.ts` declares it, or its name until it has one. */
export const DATABASE_ID = config.worker.env.DB.id ?? config.worker.env.DB.name ?? manifest.name;

/** The SQLite file `bun dev` and `bun db:local:migrate` use for the `DB` binding. */
export const LOCAL_DATABASE_FILE = join(
	PROJECT_ROOT,
	".cloudflare/state/v3/d1",
	NAMESPACE,
	`${objectId(NAMESPACE, DATABASE_ID)}.sqlite`,
);

/** Opens the local database, creating the file where `bun dev` will find it when none exists yet. */
export function openLocalDatabase(): Database {
	mkdirSync(dirname(LOCAL_DATABASE_FILE), { recursive: true });
	return createSqliteDatabase({ filename: LOCAL_DATABASE_FILE });
}
