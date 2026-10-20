/**
 * `typegen`: writes the Worker's `env` types from `cloudflare.config.ts` through `cf workers
 * types`. Run it after adding or changing a binding or a secret, so `env` and every handler
 * type check against what the Worker receives. Safe to run twice.
 */

import { utimes } from "node:fs/promises";
import { join } from "node:path";

import { createCommand, success } from "@sdxc/cli";
import { isFailure, wrap } from "@sdxc/result";

import commandset from "~/app/commands";
import { PROJECT_ROOT } from "~/app/initializers/local-database";

/** Where `cf workers types` writes the types, the file the project's tsconfig includes. */
export const TYPES_FILE = join(PROJECT_ROOT, ".cloudflare/types/index.d.ts");

/**
 * Generates the types, then stamps them with the current time: `cf` keeps an unchanged file as it
 * was, and the stamp is what tells `sdxc doctor` the types match the config after an edit that
 * adds no binding, like a cron trigger.
 */
export default createCommand(commandset.typegen, async (ctx) => {
	let generated = await ctx.exec(["cf", "workers", "types"], { cwd: PROJECT_ROOT });
	if (isFailure(generated)) return generated;
	let now = new Date();
	await wrap(() => utimes(TYPES_FILE, now, now));
	return success();
});
