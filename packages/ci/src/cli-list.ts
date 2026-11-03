/**
 * The `list` handler: runs the script with every step stubbed to pass and prints the steps it
 * reaches, or one matrix's entry keys, which a CI host's matrix is built from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand } from "@sdxc/cli";

import { listAction } from "./cli-actions.js";
import { CI_COMMANDS } from "./cli-contract.js";

export default createCommand(
	CI_COMMANDS.list,
	/** Lists without running anything; branches a failure would take are absent. */
	(ctx) => listAction(ctx, ctx.arguments.script, ctx.flags),
);
