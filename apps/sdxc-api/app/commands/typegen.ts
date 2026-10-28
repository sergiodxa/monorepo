/**
 * `typegen`: writes the Worker's `env` types from `cloudflare.config.ts` through `cf workers
 * types`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { join } from "node:path";

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";

/** The project's root, where `cf` finds `cloudflare.config.ts` and writes `.cloudflare/types`. */
const PROJECT_ROOT = join(import.meta.dirname, "../..");

/** Answers `cf`'s failure as its own, so a script that runs `typegen` stops on its exit code. */
export default createCommand(commandset.typegen, async (ctx) => {
	let generated = await ctx.exec(["cf", "workers", "types"], { cwd: PROJECT_ROOT });
	return isFailure(generated) ? generated : success();
});
