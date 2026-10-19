/**
 * Every command the app's command line answers, declared in one contract: the words typed to
 * reach it, its arguments and its flags. Each handler lives in its own file beside this one,
 * and a folder of handlers is a `commands({ … })` group here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import { DB_COMMAND } from "@sdxc/database-middleware/cli";
import * as s from "remix/data-schema";

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
				pending: flag.boolean("pending", {
					description: "Print the ones the database lacks, one per line, and apply nothing",
				}),
			},
			examples: ["db migrate", "db migrate --remote", "db migrate --remote --pending"],
		}),
	}),
	emails: commands({
		preview: command({
			description: "Print a declared email rendered from its template's preview() props",
			arguments: {
				name: argument(s.string(), { description: "The email's name, such as postingPublished" }),
			},
			flags: {
				locale: flag.string("locale", {
					description: "The language to render it in; the fallback language without one",
				}),
				html: flag.boolean("html", { description: "Print the HTML part instead of the text" }),
			},
			examples: [
				"emails preview postingPublished",
				"emails preview postingPublished --locale es --html",
			],
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
