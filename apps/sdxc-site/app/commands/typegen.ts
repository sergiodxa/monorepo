/**
 * `typegen`: writes the Worker's `env` types from `cloudflare.config.ts` through `cf workers
 * types`. Run it after adding or changing a binding or a secret, so `env` and every handler
 * type check against what the Worker receives. Safe to run twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";

/** The project's root, where `cf` finds `cloudflare.config.ts` whichever directory ran the command. */
const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export default createCommand(commandset.typegen, async (ctx) => {
	let generated = await ctx.exec(["cf", "workers", "types"], { cwd: PROJECT_ROOT });
	return isFailure(generated) ? generated : success();
});
