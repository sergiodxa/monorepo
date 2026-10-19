/**
 * `deploy`: uploads the Worker with `wrangler deploy`, which reads the build `vp build` wrote.
 * `sdxc deploy` runs it once the build and the production migrations succeed, so this command
 * is where the app decides how it ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { PROJECT_ROOT } from "~/app/initializers/local-database";

/** With `--dry-run`, `wrangler` bundles and validates the Worker and uploads nothing. */
export default createCommand(commandset.deploy, async (ctx) => {
	let command = ["bunx", "wrangler", "deploy", ...(ctx.flags.dryRun ? ["--dry-run"] : [])];
	let deployed = await ctx.exec(command, { cwd: PROJECT_ROOT });
	return isFailure(deployed) ? deployed : success();
});
