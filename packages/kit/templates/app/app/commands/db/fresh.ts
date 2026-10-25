/**
 * `db fresh`: drops every table in the local database and applies the whole migration chain
 * again, for starting over after editing a migration that already ran. `--seed` runs `db seed`
 * on the empty tables.
 */

import type { AnyCommandContext, CommandResult } from "@sdxc/cli";

import { createCommand, failure, success } from "@sdxc/cli";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { isFailure } from "@sdxc/result";

import type { MigrationDatabase } from "~/app/services/migrations";

import commandset from "~/app/commands";
import { LOCAL_DATABASE_FILE, PROJECT_ROOT } from "~/app/initializers/local-database";
import { runCommand } from "~/app/services/commands";
import { applyMigrations, dropTables, readMigrations } from "~/app/services/migrations";

/** Empties `database` and applies the chain to it, printing each table dropped and migration applied. */
async function rebuild(
	ctx: AnyCommandContext,
	database: MigrationDatabase,
): Promise<CommandResult> {
	let dropped = dropTables(database);
	if (isFailure(dropped)) return dropped;
	ctx.stdout(`Dropped ${dropped.data.length} ${dropped.data.length === 1 ? "table" : "tables"}\n`);
	let applied = applyMigrations(database, await readMigrations(PROJECT_ROOT));
	if (isFailure(applied)) return applied;
	ctx.stdout(applied.data.map((name) => `Applied ${name}\n`).join(""));
	return success();
}

/** Refuses `--remote`: emptying production has no undo. */
export default createCommand(commandset.db.fresh, async (ctx) => {
	if (ctx.flags.remote) {
		return failure(new Error("db fresh drops every table, so it runs only on the local database"));
	}

	let database = openDatabase(LOCAL_DATABASE_FILE);
	let rebuilt = await rebuild(ctx, database).finally(() => database.close());
	if (isFailure(rebuilt)) return rebuilt;
	return ctx.flags.seed ? runCommand(ctx, ["db", "seed"]) : success();
});
