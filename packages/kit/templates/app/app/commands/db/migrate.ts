/**
 * `db migrate`: applies every migration in `database/migrations/` the database lacks. Locally it
 * writes the SQLite file `bun dev` serves from; with `--remote` it runs `cf d1 migrations apply`
 * against the production database. Safe to run twice: an applied migration is skipped.
 */

import type { AnyCommandContext, CommandResult } from "@sdxc/cli";
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

/** The migration names `cf d1 migrations list` printed as JSON, or `null` for any other output. */
function listedNames(printed: string): string[] | null {
	let json = wrap(() => JSON.parse(printed.replace(ANSI, "")) as unknown);
	if (isFailure(json)) return null;
	let parsed = s.parseSafe(REMOTE_PENDING, json.data);
	return parsed.success ? parsed.value.map((row) => row.Name) : null;
}

/** The migrations the production database lacks, as `cf d1 migrations list` reports them. */
async function remotePending(ctx: AnyCommandContext): Promise<Result<string[], Error>> {
	let listed = await ctx.exec(
		["cf", "d1", "migrations", "list", DATABASE_ID, "--dir", MIGRATIONS_DIRECTORY],
		{ cwd: PROJECT_ROOT, stdio: "collect" },
	);
	if (isFailure(listed)) return listed;
	let names = listedNames(listed.data.stdout);
	return names === null
		? failure(new Error(`cf d1 migrations list printed ${listed.data.stdout.trim()}`))
		: success(names);
}

/** Applies, or with `pending` lists, the migrations the production database lacks, through `cf`. */
async function migrateRemote(ctx: AnyCommandContext, pending: boolean): Promise<CommandResult> {
	if (pending) {
		let names = await remotePending(ctx);
		if (isFailure(names)) return names;
		ctx.stdout(names.data.map((name) => `${name}\n`).join(""));
		return success();
	}
	let applied = await ctx.exec(
		["cf", "d1", "migrations", "apply", DATABASE_ID, "--dir", MIGRATIONS_DIRECTORY],
		{ cwd: PROJECT_ROOT },
	);
	return isFailure(applied) ? applied : success();
}

/** Applies, or with `pending` lists, the migrations the local SQLite file lacks. */
async function migrateLocal(ctx: AnyCommandContext, pending: boolean): Promise<CommandResult> {
	let database = openDatabase(LOCAL_DATABASE_FILE);
	try {
		let migrations = await readMigrations(PROJECT_ROOT);
		if (pending) {
			let names = pendingMigrations(database, migrations).map((migration) => migration.name);
			ctx.stdout(names.map((name) => `${name}\n`).join(""));
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
}

/**
 * With `--pending`, prints one migration name per line and applies nothing; an up-to-date
 * database prints nothing. `sdxc deploy` reads that list to show what production will run.
 */
export default createCommand(commandset.db.migrate, (ctx) =>
	ctx.flags.remote
		? migrateRemote(ctx, ctx.flags.pending === true)
		: migrateLocal(ctx, ctx.flags.pending === true),
);
