/**
 * The `clean` handler: empties the step cache and run history kept in the clone's git
 * directory, for when a store grew stale or large, leaving the signoff records `signoff` reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand } from "@sdxc/cli";

import { cleanAction } from "./clean.js";
import { CI_COMMANDS } from "./cli-contract.js";

export default createCommand(
	CI_COMMANDS.clean,
	/** Exits 2 outside a git repository, where there is no store to clean. */
	(ctx) => cleanAction(ctx, ctx.flags),
);
