/**
 * Every command the site's command line answers, declared in one contract: the words typed to
 * reach it, its arguments and its flags. Each handler lives in its own file beside this one,
 * and a folder of handlers is a `commands({ … })` group here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { command, commands, flag } from "@sdxc/cli";

/** The site's commands; `sdxc make command <name>` declares one here and maps its handler. */
export default commands({
	about: command({
		description: "Print the app's name, its sdxc and remix versions, and the runtime",
		flags: { json: flag.boolean("json", { description: "Print it as JSON" }) },
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
