/**
 * The `sdxc-merge-patch apply` handler: a merge patch applied to a JSON document, the merged
 * document printed to stdout. Exits 2 when either input cannot be read or is not JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { apply } from "./apply.js";
import { MERGE_PATCH_COMMANDS } from "./cli-contract.js";
import { formatJSON, isStdin, readDocument } from "./cli-input.js";

/**
 * Reads the patch and the document, the document from stdin when it is `-` or left out; only
 * one of the two can come from stdin.
 */
export default createCommand(MERGE_PATCH_COMMANDS.apply, async (ctx) => {
	if (isStdin(ctx.arguments.patch) && isStdin(ctx.arguments.document)) {
		return usage("Only one of patch and document can come from stdin");
	}
	let patch = await readDocument(ctx, ctx.arguments.patch);
	if (isFailure(patch)) return patch;
	let document = await readDocument(ctx, ctx.arguments.document);
	if (isFailure(document)) return document;

	ctx.stdout(formatJSON(apply(document.data, patch.data), ctx.flags.compact === true));
	return success();
});
