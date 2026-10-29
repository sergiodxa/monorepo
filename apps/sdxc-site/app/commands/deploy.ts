/**
 * `deploy`: uploads the Worker the build wrote to `.cloudflare/output` with `cf deploy
 * --prebuilt`. `sdxc deploy` runs it once the build and the production migrations succeed, so
 * this command is where the app decides how it ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";

/** The project's root, where `cf` finds `cloudflare.config.ts` and `.cloudflare/output`. */
const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** With `--dry-run`, `cf` checks the build and the account and uploads nothing. */
export default createCommand(commandset.deploy, async (ctx) => {
	let command = ["cf", "deploy", "--prebuilt", ...(ctx.flags.dryRun ? ["--dry-run"] : [])];
	let deployed = await ctx.exec(command, { cwd: PROJECT_ROOT });
	return isFailure(deployed) ? deployed : success();
});
