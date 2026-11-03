/**
 * The `signoff` handler: posts the `sdxc/ci` status an earlier green run recorded for a commit,
 * for when the run could not post it, such as offline or before the commit was pushed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand } from "@sdxc/cli";

import { signoffAction } from "./cli-actions.js";
import { CI_COMMANDS } from "./cli-contract.js";

export default createCommand(
	CI_COMMANDS.signoff,
	/** Exits 1 for a commit no green run recorded, so an untested commit is never marked green. */
	(ctx) => signoffAction(ctx, { ...ctx.flags, sha: ctx.arguments.sha }),
);
