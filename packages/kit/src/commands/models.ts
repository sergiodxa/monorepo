/**
 * The `sdxc models` handler: loads each model in the project's runtime and prints its table and
 * how the migrations compare with it, as a list, one model in full, or JSON for an agent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { project } from "../middleware.js";
import { formatModel, formatModelList, summarizeModels } from "../models.js";

/** Prints every model as a row, or each named one in full. */
export default createCommand(SDXC_COMMANDS.models, {
	middleware: [project()],
	/** Fails naming the model when one is unknown or cannot be loaded. */
	async handler(ctx) {
		let models = await summarizeModels(ctx, ctx.project, ctx.arguments.names);
		if (isFailure(models)) return models;
		if (ctx.flags.json) ctx.stdout(`${JSON.stringify(models.data, null, 2)}\n`);
		else if (ctx.arguments.names.length === 0) ctx.stdout(formatModelList(models.data));
		else ctx.stdout(models.data.map(formatModel).join("\n"));
		return success();
	},
});
