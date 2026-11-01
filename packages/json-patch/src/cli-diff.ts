/**
 * The `sdxc-json-patch diff` handler: reads two JSON documents and prints the patch `diff`
 * computes, which turns the first into the second; equal documents print `[]`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSON_PATCH_COMMANDS } from "./cli-contract.js";
import { formatJSON, readJSON } from "./cli-input.js";

import { diff } from "./index.js";

/** Prints the patch on stdout; at most one of the two documents comes from stdin. */
export default createCommand(JSON_PATCH_COMMANDS.diff, async (ctx) => {
	let { before: beforeFile, after: afterFile } = ctx.arguments;
	if (beforeFile === "-" && afterFile === "-") {
		return usage("Read one document from stdin, not both");
	}

	let before = await readJSON(ctx, beforeFile);
	if (isFailure(before)) return before;
	let after = await readJSON(ctx, afterFile);
	if (isFailure(after)) return after;

	ctx.stdout(formatJSON(diff(before.data, after.data), ctx.flags.compact));
	return success();
});
