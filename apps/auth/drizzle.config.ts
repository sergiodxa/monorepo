/**
 * Drizzle Kit configuration for the auth database. Loads Cloudflare
 * credentials from `.dev.vars` when present and targets a SQLite/D1 dialect,
 * switching to the d1-http driver only when account, database, and API token
 * are available so migration generation works without live credentials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as FS from "node:fs";
import * as Path from "node:path";
import { fileURLToPath } from "node:url";

import { configDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";

let dirname = Path.dirname(fileURLToPath(import.meta.url));
let path = Path.resolve(dirname, ".dev.vars");

if (FS.existsSync(path)) {
	configDotenv({
		path: Path.join(dirname, ".dev.vars"),
		override: false,
	});
}

const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AUTH_DATABASE_ID, CLOUDFLARE_API_TOKEN } = process.env;

// Only require credentials if they're needed (for push/pull, not generate)
let dbCredentials =
	CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_AUTH_DATABASE_ID && CLOUDFLARE_API_TOKEN
		? {
				accountId: CLOUDFLARE_ACCOUNT_ID,
				databaseId: CLOUDFLARE_AUTH_DATABASE_ID,
				token: CLOUDFLARE_API_TOKEN,
			}
		: undefined;

export default defineConfig({
	dialect: "sqlite", // D1 uses SQLite
	driver: dbCredentials ? "d1-http" : undefined, // Configure to use D1 over HTTP when credentials are available
	migrations: { prefix: "timestamp" }, // Add a timestamp prefix to migrations
	strict: true, // Enable strict mode
	schema: "./db/schema.ts", // Set the schema file path
	out: "./db/migrations", // Set where we will store the migrations
	// Configure the database credentials so it can connect to Cloudflare
	dbCredentials,
});
