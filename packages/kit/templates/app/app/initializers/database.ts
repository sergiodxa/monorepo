/**
 * The app's database: `remix/data-table` over the `DB` D1 binding. The router and the job
 * dispatcher publish it as `ctx.db`, so a controller, a job and a model bound with
 * `Model.bind({ db: ctx.db })` all read and write the same tables.
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

/**
 * Opens the database over the `DB` binding. Timestamps are written as epoch milliseconds,
 * since `sdxc make model` types `created_at` and `updated_at` as integer columns and D1 binds
 * no `Date`.
 */
export function openDatabase(): Database {
	return new Database(createD1DatabaseAdapter(env.DB), { now: () => Date.now() });
}
