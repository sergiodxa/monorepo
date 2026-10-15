/**
 * The `sdxc init` handler: writes `.config/sdxc.jsonc` at the project root, or prints it under
 * `--dry-run`, and names an existing configuration instead of touching it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { init } from "../init.js";
import { project } from "../middleware.js";

/** Writes the configuration, or prints it under `--dry-run`, in the project `project()` found. */
export default createCommand(SDXC_COMMANDS.init, {
	middleware: [project()],
	/** Prints the path it wrote, or the file it would write. */
	async handler(ctx) {
		let outcome = await init(ctx.project.root, { dryRun: ctx.flags.dryRun });
		if (isFailure(outcome)) return outcome;
		if (outcome.data.written) ctx.stdout(`Wrote ${outcome.data.path}\n`);
		else ctx.stdout(`Would write ${outcome.data.path}:\n\n${outcome.data.content}`);
		return success();
	},
});
