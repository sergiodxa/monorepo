/**
 * Database access entry point for the blog. Exposes a factory that wraps a
 * Cloudflare D1 binding in a Drizzle ORM client bound to the app schema, and a
 * `Database` type derived from it. It exists so callers get a single, typed
 * handle to the database instead of touching the raw D1 binding directly.
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
