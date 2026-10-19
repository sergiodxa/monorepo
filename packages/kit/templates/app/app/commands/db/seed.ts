/**
 * `db seed`: runs the seeders `database/seeders/index.ts` lists on the local database, through
 * the app's models and factories. It writes rows as often as it runs, so a database seeds once
 * through `db prepare` and is reseeded from empty with `db fresh --seed`.
 */

import { createCommand, failure, success } from "@sdxc/cli";

import commandset from "~/app/commands";
import { runSeeders } from "~/app/services/seeders";
import SEEDERS from "~/database/seeders";

/** Prints each seeder's name as it finishes; production rows come from the app itself. */
export default createCommand(commandset.db.seed, async (ctx) => {
	if (ctx.flags.remote) {
		return failure(new Error("db seed writes only to the local database"));
	}
	if (Object.keys(SEEDERS).length === 0) {
		ctx.stdout("No seeders listed in database/seeders/index.ts\n");
		return success();
	}
	return runSeeders(SEEDERS, ctx.db, (name) => ctx.stdout(`Seeded ${name}\n`));
});
