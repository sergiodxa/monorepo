/**
 * The `run` handler: loads the script, runs it with the flags as typed, and prints each step as
 * it finishes and the summary after, or the whole report with `--json`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand } from "@sdxc/cli";

import { runAction } from "./cli-actions.js";
import { CI_COMMANDS } from "./cli-contract.js";

export default createCommand(
	CI_COMMANDS.run,
	/** Runs the script from the repository root; the exit code is the run's. */
	(ctx) => runAction(ctx, ctx.arguments.script, ctx.flags),
);
