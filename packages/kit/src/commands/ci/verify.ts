/**
 * The `sdxc ci verify` handler: the gate a CI host runs first, answering through its exit code
 * whether a contributor already signed the commit off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { verifyAction } from "@sdxc/ci/command-line";
import { createCommand } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../../contract.js";

export default createCommand(SDXC_COMMANDS.ci.verify, {
	middleware: [],
	/** Exits 0 when signed, 1 when not, 2 when GitHub cannot answer. */
	handler: (ctx) => verifyAction(ctx, { ...ctx.flags, sha: ctx.arguments.sha }),
});
