/**
 * The `sdxc middleware` handler: prints each router's global middleware and every module in
 * `app/http/middleware/`, chains expanded in run order, as text, or as JSON for an agent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../contract.js";
import { project } from "../middleware.js";
import { formatMiddleware, listMiddleware } from "../routes/chains.js";

/** Reads the routers and the middleware folder and prints every chain. */
export default createCommand(SDXC_COMMANDS.middleware, {
	middleware: [project()],
	/** Always succeeds once the project is found; a project without routers says so. */
	async handler(ctx) {
		let listing = await listMiddleware(ctx.project.root);
		ctx.stdout(
			ctx.flags.json ? `${JSON.stringify(listing, null, 2)}\n` : formatMiddleware(listing),
		);
		return success();
	},
});
