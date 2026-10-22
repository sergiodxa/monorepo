/**
 * Every command the monorepo command line answers: release, doctor, and the package/app
 * wiring commands ADR-169 adds. Handlers live beside this contract under `cli/commands/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { command, commands, flag } from "@sdxc/cli";

/** The monorepo's commands; new ones are declared here and mapped in `cli/index.ts`. */
export default commands({
	doctor: command({
		description: "Run sdxc doctor from the workspace kit in every app under apps/",
		flags: {
			json: flag.boolean("json", { description: "Print each app's report as JSON" }),
			only: flag
				.string("only", { valueName: "check", description: "Run only the named checks" })
				.multiple()
				.list(),
			skip: flag
				.string("skip", { valueName: "check", description: "Leave out the named checks" })
				.multiple()
				.list(),
		},
		examples: ["doctor", "doctor --json", "doctor --only pins,remix", "doctor --skip ui"],
	}),
});
