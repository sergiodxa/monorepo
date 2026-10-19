/**
 * The `sdxc scaffold` handler: a resource's model, migration, factory, validator, abilities, pages
 * and, on request, MCP tools and app commands, each declared and mapped as `sdxc make` does.
 * `createSDXC()` maps it through `lazy()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { packageRoot, project } from "../middleware.js";
import { scaffold } from "../scaffold/index.js";

export default createCommand(SDXC_COMMANDS.scaffold, {
	middleware: [project(), packageRoot()],
	/** Writes nothing when any part of the plan is refused; `--dry-run` prints the plan instead. */
	async handler(ctx) {
		let made = await scaffold(ctx, ctx.project, ctx.packageRoot, {
			name: ctx.arguments.name,
			fields: ctx.arguments.fields,
			plural: ctx.flags.plural,
			mcp: ctx.flags.mcp,
			command: ctx.flags.command,
			test: ctx.flags.test,
			dryRun: ctx.flags.dryRun,
			skip: ctx.flags.skip,
			api: ctx.flags.api,
		});
		if (isFailure(made)) return made;
		return success();
	},
});
