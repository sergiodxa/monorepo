/**
 * The `sdxc ci clean` handler: empties the step cache and run history `sdxc ci` keeps in the
 * clone's git directory, leaving the signoff records `sdxc ci signoff` posts from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cleanAction } from "@sdxc/ci/command-line";
import { createCommand } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../../contract.js";

export default createCommand(SDXC_COMMANDS.ci.clean, {
	middleware: [],
	/** Exits 2 outside a git repository, where there is no store to clean. */
	handler: (ctx) => cleanAction(ctx, ctx.flags),
});
