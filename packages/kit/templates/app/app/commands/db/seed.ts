/**
 * `db seed`: runs the steps of `database/seed.ts` on the local database, through the app's
 * models and factories. It writes rows as often as it runs, so a database seeds once through
 * `db prepare` and is reseeded from empty with `db fresh --seed`.
 */

import { createCommand, failure, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import seeder from "~/database/seed";

/** Prints each step's name once it ran; production rows come from the app itself. */
export default createCommand(commandset.db.seed, async (ctx) => {
	if (ctx.flags.remote) {
		return failure(new Error("db seed writes only to the local database"));
	}
	if (Object.keys(seeder.steps).length === 0) {
		ctx.stdout("No seed steps in database/seed.ts\n");
		return success();
	}
	let ran = await seeder.run({ db: ctx.db });
	if (isFailure(ran)) return ran;
	ctx.stdout(ran.data.map((name) => `Seeded ${name}\n`).join(""));
	return success();
});
