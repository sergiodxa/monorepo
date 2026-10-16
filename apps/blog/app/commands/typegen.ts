/**
 * `typegen`: writes the Worker's `env` types from `wrangler.jsonc` into
 * `worker-configuration.d.ts` through `wrangler types`. Run it after adding or changing a
 * binding or a secret, so `env` and every handler type check against what the Worker receives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { PROJECT_ROOT } from "~/app/initializers/local-database";

/** Regenerates the types in the project's root; safe to run twice. */
export default createCommand(commandset.typegen, async (ctx) => {
	let generated = await ctx.exec(["bunx", "wrangler", "types"], { cwd: PROJECT_ROOT });
	return isFailure(generated) ? generated : success();
});
