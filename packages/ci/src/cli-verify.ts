/**
 * The `verify` handler: answers through its exit code whether a contributor signed a commit
 * off, which is what a CI host's gate job runs before deciding to skip the hosted run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand } from "@sdxc/cli";

import { verifyAction } from "./cli-actions.js";
import { CI_COMMANDS } from "./cli-contract.js";

export default createCommand(
	CI_COMMANDS.verify,
	/** Exits 0 when signed, 1 when not, 2 when GitHub cannot answer. */
	(ctx) => verifyAction(ctx, { ...ctx.flags, sha: ctx.arguments.sha }),
);
