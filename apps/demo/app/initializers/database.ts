/**
 * Opens the board's database over the D1 binding. Called per request rather than held in a
 * module variable, so the binding read is the one that request was served with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

/** Opens a database over the `DB` binding. */
export function openDatabase(): Database {
	return new Database(createD1DatabaseAdapter(env.DB));
}
