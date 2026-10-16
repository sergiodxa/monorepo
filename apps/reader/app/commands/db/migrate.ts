/**
 * `db migrate`: applies every feed catalog migration the database lacks. Locally it writes the
 * SQLite file `bun dev` serves from; with `--remote` it runs `wrangler d1 migrations apply`
 * against the production catalog. Safe to run twice: an applied migration is skipped. Each
 * reader's and each feed's Durable Object migrates its own SQLite when it boots.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { createCommand, success } from "@sdxc/cli";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { CATALOG, LOCAL_DATABASE_FILE, PROJECT_ROOT } from "~/app/initializers/local-database";
import { applyMigrations } from "~/app/services/migrations";

/** Every `.sql` file in the catalog's chain, with its SQL. */
async function readMigrations() {
	let directory = join(PROJECT_ROOT, CATALOG.migrationsDirectory);
	let names = (await readdir(directory)).filter((name) => name.endsWith(".sql"));
	return Promise.all(
		names.map(async (name) => ({
			name,
			sql: await readFile(join(directory, name), "utf8"),
		})),
	);
}

export default createCommand(commandset.db.migrate, async (ctx) => {
	if (ctx.flags.remote) {
		let applied = await ctx.exec(
			["bunx", "wrangler", "d1", "migrations", "apply", CATALOG.name, "--remote"],
			{ cwd: PROJECT_ROOT },
		);
		return isFailure(applied) ? applied : success();
	}

	let database = openDatabase(LOCAL_DATABASE_FILE);
	try {
		let applied = applyMigrations(database, await readMigrations());
		if (isFailure(applied)) return applied;
		ctx.stdout(
			applied.data.length === 0
				? "No migrations to apply\n"
				: applied.data.map((name) => `Applied ${name}\n`).join(""),
		);
		return success();
	} finally {
		database.close();
	}
});
