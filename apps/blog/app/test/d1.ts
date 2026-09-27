/**
 * Workers-pool test support: brings the real local D1 binding up to the schema the
 * migrations describe, once per isolated storage, so a test drives the router against
 * the same tables production reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:test";
import { Database } from "remix/data-table";

import { applyMigrations } from "./fixtures";

/**
 * Applies every migration unless the binding already holds the `posts` table, so test
 * files sharing storage stay independent of the order they run in.
 *
 * @returns The data-table database the app's repositories use, over the migrated binding.
 */
export async function migratedDatabase(): Promise<Database> {
	let existing = await env.DB.prepare(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'posts'",
	).all();

	if ((existing.results ?? []).length === 0) await applyMigrations(env.DB);

	return new Database(createD1DatabaseAdapter(env.DB));
}
