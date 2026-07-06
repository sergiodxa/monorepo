/**
 * Database factory for the uptime app. Exports a `database` function that wraps a
 * Cloudflare D1 binding in a Drizzle ORM client bound to the app's schema, plus a
 * `Database` type alias for the returned client. It exists as the single entry
 * point for opening a typed connection to the app's data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export default function database(d1: D1Database) {
	return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof database>;
