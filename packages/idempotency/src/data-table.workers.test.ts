/**
 * Holds the data-table store to the shared store contract inside workerd, against a real
 * D1 binding, so the conditional upsert's claim semantics are Cloudflare's own and not a
 * local SQLite build's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env, reset } from "cloudflare:test";
import { Database } from "remix/data-table";

import { DataTableStore, IDEMPOTENCY_KEYS_SCHEMA_SQL } from "./data-table.js";
import { describeStoreContract } from "./lib/store-contract.js";

/**
 * Applies the schema one statement at a time, the way a migration runner does: D1's
 * `exec` reads each line as its own statement, so a multi-line `create table` fails there.
 */
async function applySchema(): Promise<void> {
	for (let statement of IDEMPOTENCY_KEYS_SCHEMA_SQL.split(";")) {
		if (statement.trim() !== "") await env.DB.prepare(statement).run();
	}
}

describeStoreContract("DataTableStore on a real D1 binding", async () => {
	await reset();
	await applySchema();
	return new DataTableStore(new Database(createD1DatabaseAdapter(env.DB)));
});
