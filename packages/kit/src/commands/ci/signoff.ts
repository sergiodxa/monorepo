/**
 * The `sdxc ci signoff` handler: posts the signoff an earlier green `sdxc ci` run recorded for a
 * commit that has since reached GitHub.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { signoffAction } from "@sdxc/ci/command-line";
import { createCommand } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../../contract.js";

export default createCommand(SDXC_COMMANDS.ci.signoff, {
	middleware: [],
	/** Exits 1 for a commit no green run recorded, so an untested commit is never marked green. */
	handler: (ctx) => signoffAction(ctx, { ...ctx.flags, sha: ctx.arguments.sha }),
});
