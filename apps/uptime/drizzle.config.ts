/**
 * Drizzle Kit configuration for the uptime app's Cloudflare D1 database. Loads
 * credentials from a local `.dev.vars` file when present, validates that the
 * Cloudflare account, database, and API token are set, then defines the SQLite
 * dialect over the D1 HTTP driver along with schema and migration output paths.
 * It exists so migrations can be generated and pushed to D1 from the CLI.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as FS from "node:fs";
import * as Path from "node:path";
import { fileURLToPath } from "node:url";

import { configDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";

const __dirname = Path.dirname(fileURLToPath(import.meta.url));
let path = Path.resolve(__dirname, ".dev.vars");

if (FS.existsSync(path)) {
	configDotenv({
		path: Path.join(__dirname, ".dev.vars"),
		override: false,
	});
}

const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_UPTIME_DATABASE_ID, CLOUDFLARE_API_TOKEN } = process.env;

if (!CLOUDFLARE_ACCOUNT_ID) throw new Error("Missing Cloudflare account ID");
if (!CLOUDFLARE_UPTIME_DATABASE_ID) {
	throw new Error("Missing Cloudflare uptime database ID");
}
if (!CLOUDFLARE_API_TOKEN) throw new Error("Missing Cloudflare API token");

export default defineConfig({
	dialect: "sqlite", // D1 uses SQLite
	driver: "d1-http", // Configure to use D1 over HTTP
	migrations: { prefix: "timestamp" }, // Add a timestamp prefix to migrations
	strict: true, // Enable strict mode
	schema: "./db/schema.ts", // Set the schema file path
	out: "./db/migrations", // Set where we will store the migrations
	// Configure the database credentials so it can connect to Cloudflare
	dbCredentials: {
		accountId: CLOUDFLARE_ACCOUNT_ID,
		databaseId: CLOUDFLARE_UPTIME_DATABASE_ID,
		token: CLOUDFLARE_API_TOKEN,
	},
});
