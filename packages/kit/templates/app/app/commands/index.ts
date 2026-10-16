/**
 * Every command the app's command line answers, declared in one contract: the words typed to
 * reach it, its arguments and its flags. Each handler lives in its own file beside this one,
 * and a folder of handlers is a `commands({ … })` group here.
 */

import { command, commands, flag } from "@sdxc/cli";
import { DB_COMMAND } from "@sdxc/database-middleware/cli";

/** The app's commands; `sdxc make command <name>` declares one here and maps its handler. */
export default commands({
	about: command({
		description: "Print the app's name, its @sdxc/cli and remix versions, and the runtime",
		flags: { json: flag.boolean("json", { description: "Print it as JSON" }) },
	}),
	db: commands({
		console: DB_COMMAND,
		migrate: command({
			description: "Apply the migrations in database/migrations the database lacks",
			flags: {
				remote: flag.boolean("remote", {
					description: "Apply them to the production database instead of the local copy",
				}),
			},
			examples: ["db migrate", "db migrate --remote"],
		}),
	}),
	typegen: command({
		description: "Write the Worker's env types from cloudflare.config.ts",
	}),
});
