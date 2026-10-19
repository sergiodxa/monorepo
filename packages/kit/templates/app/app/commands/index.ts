/**
 * Every command the app's command line answers, declared in one contract: the words typed to
 * reach it, its arguments and its flags. Each handler lives in its own file beside this one,
 * and a folder of handlers is a `commands({ … })` group here.
 */

import { command, commands, flag } from "@sdxc/cli";
import { DB_COMMAND } from "@sdxc/database-middleware/cli";

/** Declared on the commands that change only the local database, so `--remote` is refused by name. */
const LOCAL_ONLY = flag.boolean("remote", {
	description: "Refused: this command changes only the local database",
});

/** The app's commands; `sdxc make command <name>` declares one here and maps its handler. */
export default commands({
	about: command({
		description: "Print the app's name, its @sdxc/cli and remix versions, and the runtime",
		flags: { json: flag.boolean("json", { description: "Print it as JSON" }) },
	}),
	console: command({
		description: "Open a REPL with the local database as db and the app's models as models",
		examples: ["console"],
	}),
	db: commands({
		console: DB_COMMAND,
		fresh: command({
			description: "Drop every local table and apply every migration again",
			flags: {
				seed: flag.boolean("seed", { description: "Run db seed afterwards" }),
				remote: LOCAL_ONLY,
			},
			examples: ["db fresh", "db fresh --seed"],
		}),
		migrate: command({
			description: "Apply the migrations in database/migrations the database lacks",
			flags: {
				remote: flag.boolean("remote", {
					description: "Apply them to the production database instead of the local copy",
				}),
				pending: flag.boolean("pending", {
					description: "Print the ones the database lacks, one per line, and apply nothing",
				}),
			},
			examples: ["db migrate", "db migrate --remote", "db migrate --remote --pending"],
		}),
		prepare: command({
			description: "Apply pending local migrations, and seed a database that had none applied",
			flags: { remote: LOCAL_ONLY },
			examples: ["db prepare"],
		}),
		seed: command({
			description: "Run the seeders in database/seeders on the local database",
			flags: { remote: LOCAL_ONLY },
			examples: ["db seed"],
		}),
	}),
	deploy: command({
		description: "Upload the build in .cloudflare/output to Cloudflare with cf deploy",
		flags: {
			dryRun: flag.boolean("dry-run", {
				description: "Run cf's checks on the build and upload nothing",
			}),
		},
		examples: ["deploy", "deploy --dry-run"],
	}),
	typegen: command({
		description: "Write the Worker's env types from cloudflare.config.ts",
	}),
});
