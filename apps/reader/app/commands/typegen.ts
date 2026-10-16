/**
 * `typegen`: writes the Worker's `env` types from `wrangler.jsonc` through `wrangler types`. Run
 * it after adding or changing a binding, a variable or a secret, so `env` and every handler type
 * check against what the Worker receives. Safe to run twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { PROJECT_ROOT } from "~/app/initializers/local-database";

export default createCommand(commandset.typegen, async (ctx) => {
	let generated = await ctx.exec(["bunx", "wrangler", "types"], { cwd: PROJECT_ROOT });
	return isFailure(generated) ? generated : success();
});
