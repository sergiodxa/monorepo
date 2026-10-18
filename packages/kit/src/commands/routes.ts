/**
 * The `sdxc routes` handler: prints every route of the project, its controller and the
 * middleware that runs for it, as a table or, with `--json`, as an array an agent parses.
 * Diagnostics go to stderr, so stdout always holds the listing alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../contract.js";
import { project } from "../middleware.js";
import { formatJSON, formatTable } from "../routes/format.js";
import { listRoutes } from "../routes/index.js";

/** Reads the project's contracts and routers and prints what they declare and map. */
export default createCommand(SDXC_COMMANDS.routes, {
	middleware: [project()],
	/** Always succeeds once the project is found; a route it cannot read is a diagnostic. */
	async handler(ctx) {
		let listing = await listRoutes(ctx.project.root);
		ctx.stdout(ctx.flags.json ? formatJSON(listing) : formatTable(listing));
		for (let diagnostic of listing.diagnostics) ctx.stderr(`${diagnostic}\n`);
		return success();
	},
});
