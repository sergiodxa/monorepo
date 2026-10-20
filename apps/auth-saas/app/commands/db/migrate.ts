/**
 * `db migrate`: applies every control-plane migration in `database/migrations/` the database
 * lacks. Locally it writes the SQLite file `bun dev` serves from; with `--remote` it runs
 * `wrangler d1 migrations apply` against the production database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, success } from "@sdxc/cli";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { failure, isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import {
	LOCAL_DATABASE_FILE,
	PLATFORM_DATABASE,
	PROJECT_ROOT,
} from "~/app/initializers/local-database";
import { applyMigrations, pendingMigrations } from "~/app/services/migrations";

/** The control-plane chain `wrangler.jsonc` points `migrations_dir` at, relative to the root. */
const MIGRATIONS_DIRECTORY = "database/migrations";

/** A row of the table `wrangler d1 migrations list` prints, holding one migration's file name. */
const TABLE_ROW = /│\s*([^│]+?\.sql)\s*│/;

/** What `wrangler d1 migrations list` prints instead of a table when production is current. */
const UP_TO_DATE = "No migrations to apply";

/** Escape sequences `wrangler` colors its table with when its output is a terminal. */
// oxlint-disable-next-line no-control-regex -- matching the ESC that starts a color sequence
const ANSI = /\u001B\[[0-9;]*m/g;

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

/**
 * The migrations the production database lacks, read from the table `wrangler d1 migrations
 * list` prints; output with neither a table row nor the up-to-date notice is a failure.
 */
async function remotePending(ctx: AnyCommandContext): Promise<Result<string[], Error>> {
	let listed = await ctx.exec(
		["bunx", "wrangler", "d1", "migrations", "list", PLATFORM_DATABASE.name, "--remote"],
		{ cwd: PROJECT_ROOT, stdio: "collect" },
	);
	if (isFailure(listed)) return listed;
	let printed = listed.data.stdout.replace(ANSI, "");
	let names = printed.split("\n").flatMap((line) => {
		let name = TABLE_ROW.exec(line)?.[1];
		return name === undefined ? [] : [name];
	});
	if (names.length === 0 && !printed.includes(UP_TO_DATE)) {
		return failure(new Error(`wrangler d1 migrations list printed ${printed.trim()}`));
	}
	return success(names);
}

/**
 * Safe to run twice: an applied migration is skipped, locally and remotely. With `--pending`
 * it prints one name per line and applies nothing; `sdxc deploy` reads that list.
 */
export default createCommand(commandset.db.migrate, async (ctx) => {
	if (ctx.flags.remote) {
		if (ctx.flags.pending) {
			let pending = await remotePending(ctx);
			if (isFailure(pending)) return pending;
			ctx.stdout(pending.data.map((name) => `${name}\n`).join(""));
			return success();
		}
		let applied = await ctx.exec(
			["bunx", "wrangler", "d1", "migrations", "apply", PLATFORM_DATABASE.name, "--remote"],
			{ cwd: PROJECT_ROOT },
		);
		return isFailure(applied) ? applied : success();
	}

	let database = openDatabase(LOCAL_DATABASE_FILE);
	try {
		let migrations = await readMigrations();
		if (ctx.flags.pending) {
			ctx.stdout(
				pendingMigrations(database, migrations)
					.map((migration) => `${migration.name}\n`)
					.join(""),
			);
			return success();
		}
		let applied = applyMigrations(database, migrations);
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
