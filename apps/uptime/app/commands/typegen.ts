/**
 * `typegen`: writes the Worker's `env` types from `wrangler.jsonc` and `.env.example` into
 * `worker-configuration.d.ts` through `wrangler types`. Secrets are typed from `.env.example`,
 * so every machine and CI generate the same types whatever a local `.dev.vars` holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { PROJECT_ROOT } from "~/app/initializers/local-database";

/** Safe to run twice: each run rewrites the same file. */
export default createCommand(commandset.typegen, async (ctx) => {
	let generated = await ctx.exec(["bunx", "wrangler", "types", "--env-file", ".env.example"], {
		cwd: PROJECT_ROOT,
	});
	return isFailure(generated) ? generated : success();
});
