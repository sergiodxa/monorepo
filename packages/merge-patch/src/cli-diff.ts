/**
 * The `sdxc-merge-patch diff` handler: the smallest merge patch that turns one JSON document
 * into another, printed to stdout. Exits 1 when the second document sets an object member to
 * `null`, which no merge patch can express, and 2 when either input cannot be read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, failure, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { MERGE_PATCH_COMMANDS } from "./cli-contract.js";
import { formatJSON, isStdin, readDocument } from "./cli-input.js";
import { diff } from "./diff.js";

/** Reads both documents, at most one of them from stdin, and prints the patch between them. */
export default createCommand(MERGE_PATCH_COMMANDS.diff, async (ctx) => {
	if (isStdin(ctx.arguments.before) && isStdin(ctx.arguments.after)) {
		return usage("Only one of before and after can come from stdin");
	}
	let before = await readDocument(ctx, ctx.arguments.before);
	if (isFailure(before)) return before;
	let after = await readDocument(ctx, ctx.arguments.after);
	if (isFailure(after)) return after;

	let patch = diff(before.data, after.data);
	if (isFailure(patch)) return failure(patch.error);
	ctx.stdout(formatJSON(patch.data, ctx.flags.compact === true));
	return success();
});
