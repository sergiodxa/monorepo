/**
 * `db migrate`: applies every control-plane migration in `database/migrations/` the database
 * lacks. Locally it writes the SQLite file `bun dev` serves from; with `--remote` it runs
 * `wrangler d1 migrations apply` against the production database. Tenant chains run in each
 * tenant's Durable Object instead.
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
import {
	LOCAL_DATABASE_FILE,
	PLATFORM_DATABASE,
	PROJECT_ROOT,
} from "~/app/initializers/local-database";
import { applyMigrations } from "~/app/services/migrations";

/** The control-plane chain `wrangler.jsonc` points `migrations_dir` at, relative to the root. */
const MIGRATIONS_DIRECTORY = "database/migrations";

/** Every `.sql` file in the chain, with its SQL. */
async function readMigrations() {
	let directory = join(PROJECT_ROOT, MIGRATIONS_DIRECTORY);
	let names = (await readdir(directory)).filter((name) => name.endsWith(".sql"));
	return Promise.all(
		names.map(async (name) => ({
			name,
			sql: await readFile(join(directory, name), "utf8"),
		})),
	);
}

/** Safe to run twice: an applied migration is skipped, locally and remotely. */
export default createCommand(commandset.db.migrate, async (ctx) => {
	if (ctx.flags.remote) {
		let applied = await ctx.exec(
			["bunx", "wrangler", "d1", "migrations", "apply", PLATFORM_DATABASE.name, "--remote"],
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
