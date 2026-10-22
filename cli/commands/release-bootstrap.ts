/**
 * `release bootstrap`: first-publishes packages npm has never seen as `0.0.0-pre.1` under the
 * `alpha` tag from the operator's npm session, then prints the trusted-publisher settings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { runBootstrap } from "../../scripts/release/bootstrap.js";

import commandset from "./index.js";

/** Bootstraps the named packages, or every unpublished public package. */
export default createCommand(commandset.release.bootstrap, async (ctx) => {
	let ran = await runBootstrap({
		dryRun: ctx.flags.dryRun,
		packages: ctx.arguments.packages,
		say: (text) => ctx.stdout(`${text}\n`),
	});
	if (isFailure(ran)) return exit(1, ran.error.message);
	return success();
});
