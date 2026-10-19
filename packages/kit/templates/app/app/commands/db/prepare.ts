/**
 * `db prepare`: brings the local database up to date for a fresh clone, CI or after a pull, by
 * running `db migrate`, then `db seed` when the database had no migration applied. Safe to run
 * on every start: a database in use only gains its pending migrations.
 */

import { createCommand, failure } from "@sdxc/cli";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { LOCAL_DATABASE_FILE } from "~/app/initializers/local-database";
import { runCommand } from "~/app/services/commands";
import { hasAppliedMigrations } from "~/app/services/migrations";

/** Seeds only a new database, so its seeded rows are written once. */
export default createCommand(commandset.db.prepare, async (ctx) => {
	if (ctx.flags.remote) {
		return failure(
			new Error("db prepare runs only on the local database; deploy migrates production"),
		);
	}

	let database = openDatabase(LOCAL_DATABASE_FILE);
	let isNew: boolean;
	try {
		isNew = !hasAppliedMigrations(database);
	} finally {
		database.close();
	}

	let migrated = await runCommand(ctx, ["db", "migrate"]);
	if (isFailure(migrated) || !isNew) return migrated;
	return runCommand(ctx, ["db", "seed"]);
});
