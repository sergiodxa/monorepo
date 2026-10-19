/**
 * The `sdxc initializers` handler: prints every initializer with what it exports and the
 * factories that build it, as a table, or as JSON for an agent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../contract.js";
import { formatInitializers, listInitializers } from "../initializers.js";
import { project } from "../middleware.js";

/** Reads `app/initializers/` and prints what it found. */
export default createCommand(SDXC_COMMANDS.initializers, {
	middleware: [project()],
	/** Always succeeds once the project is found; an empty folder says so. */
	async handler(ctx) {
		let initializers = await listInitializers(ctx.project.root);
		ctx.stdout(
			ctx.flags.json
				? `${JSON.stringify(initializers, null, 2)}\n`
				: formatInitializers(initializers),
		);
		return success();
	},
});
