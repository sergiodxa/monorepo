/**
 * Database factory for the auth app. Wraps a Cloudflare D1 binding in a Drizzle
 * ORM client bound to the app schema and exports the resulting `Database` type,
 * giving the rest of the app a single, typed entry point for querying the DB.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export type Database = ReturnType<typeof database>;

export default function database(d1: D1Database) {
	return drizzle(d1, { schema });
}
