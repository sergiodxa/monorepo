/**
 * `db seed`: runs the steps of `database/seed.ts` on the local database `bun dev` serves, printing
 * each step's name once it ran. It writes rows as often as it runs, so seed a freshly migrated
 * database once; production rows come from the app itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { commandJobs } from "~/app/initializers/cli";
import seeder from "~/database/seed";

/** A failing step stops the run and names itself; the steps before it keep their rows. */
export default createCommand(commandset.db.seed, async (ctx) => {
	let ran = await seeder.run({ db: ctx.db, jobs: commandJobs });
	if (isFailure(ran)) return ran;
	ctx.stdout(ran.data.map((name) => `Seeded ${name}\n`).join(""));
	return success();
});
