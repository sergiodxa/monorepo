/**
 * `db migrate`: applies every migration in `database/migrations/` the database lacks. Locally it
 * writes the SQLite file `bun dev` serves from; with `--remote` it runs `cf d1 migrations apply`
 * against the production database. Safe to run twice: an applied migration is skipped.
 */

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, success } from "@sdxc/cli";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { failure, isFailure, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";

import commandset from "~/app/commands";
import { DATABASE_ID, LOCAL_DATABASE_FILE, PROJECT_ROOT } from "~/app/initializers/local-database";
import {
	applyMigrations,
	MIGRATIONS_DIRECTORY,
	pendingMigrations,
	readMigrations,
} from "~/app/services/migrations";

/** `cf d1 migrations list`'s JSON: one row per migration the production database lacks. */
const REMOTE_PENDING = s.array(s.object({ Name: s.string() }));

/** Escape sequences `cf` colors its JSON with when its output is a terminal. */
// oxlint-disable-next-line no-control-regex -- matching the ESC that starts a color sequence
const ANSI = /\u001B\[[0-9;]*m/g;

/** The migrations the production database lacks, as `cf d1 migrations list` reports them. */
async function remotePending(ctx: AnyCommandContext): Promise<Result<string[], Error>> {
	let listed = await ctx.exec(
		["cf", "d1", "migrations", "list", DATABASE_ID, "--dir", MIGRATIONS_DIRECTORY],
		{ cwd: PROJECT_ROOT, stdio: "collect" },
	);
	if (isFailure(listed)) return listed;
	let printed = listed.data.stdout;
	let json = wrap(() => JSON.parse(printed.replace(ANSI, "")) as unknown);
	let parsed = isFailure(json) ? undefined : s.parseSafe(REMOTE_PENDING, json.data);
	if (parsed === undefined || !parsed.success) {
		return failure(new Error(`cf d1 migrations list printed ${printed.trim()}`));
	}
	return success(parsed.value.map((row) => row.Name));
}

/**
 * With `--pending`, prints one migration name per line and applies nothing; an up-to-date
 * database prints nothing. `sdxc deploy` reads that list to show what production will run.
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
			["cf", "d1", "migrations", "apply", DATABASE_ID, "--dir", MIGRATIONS_DIRECTORY],
			{ cwd: PROJECT_ROOT },
		);
		return isFailure(applied) ? applied : success();
	}

	let database = openDatabase(LOCAL_DATABASE_FILE);
	try {
		let migrations = await readMigrations(PROJECT_ROOT);
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
