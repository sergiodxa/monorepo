/**
 * The `sdxc-json-patch apply` handler: reads a patch and a document, applies the patch with
 * `apply` and prints the patched document. An operation whose path or `test` fails exits 1
 * naming its index; a patch or document that cannot be read exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSON_PATCH_COMMANDS } from "./cli-contract.js";
import { bothStdin, formatJSON, readInput, readJSON } from "./cli-input.js";

import { apply, parse } from "./index.js";

/** Prints the patched document on stdout, or `Operation <index>: <reason>` on stderr. */
export default createCommand(JSON_PATCH_COMMANDS.apply, async (ctx) => {
	let { patch: patchFile, document: documentFile } = ctx.arguments;
	if (bothStdin(patchFile, documentFile)) {
		return usage("Read the patch or the document from stdin, not both");
	}

	let input = await readInput(ctx, patchFile);
	if (isFailure(input)) return input;
	let patch = parse(input.data.text);
	if (isFailure(patch)) return exit(2, `${input.data.name}: ${patch.error.message}`);

	let document = await readJSON(ctx, documentFile);
	if (isFailure(document)) return document;

	let patched = apply(document.data, patch.data);
	if (isFailure(patched)) return exit(1, patched.error.message);

	ctx.stdout(formatJSON(patched.data, ctx.flags.compact));
	return success();
});
