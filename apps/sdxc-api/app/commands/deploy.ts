/**
 * `deploy`: uploads the Worker the build wrote to `.cloudflare/output` with `cf deploy
 * --prebuilt`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { join } from "node:path";

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";

/** The project's root, where `cf` finds `cloudflare.config.ts` and `.cloudflare/output`. */
const PROJECT_ROOT = join(import.meta.dirname, "../..");

/** With `--dry-run`, `cf` checks the build and the account and uploads nothing. */
export default createCommand(commandset.deploy, async (ctx) => {
	let command = ["cf", "deploy", "--prebuilt", ...(ctx.flags.dryRun ? ["--dry-run"] : [])];
	let deployed = await ctx.exec(command, { cwd: PROJECT_ROOT });
	return isFailure(deployed) ? deployed : success();
});
