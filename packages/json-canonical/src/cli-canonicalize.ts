/**
 * The `canonicalize` handler: prints a JSON document's RFC 8785 form with no trailing newline,
 * so the bytes on stdout are exactly what a signer or hasher must see; `--newline` adds one for
 * a terminal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSON_CANONICAL_COMMANDS } from "./cli-contract.js";
import { readCanonical } from "./cli-input.js";

export default createCommand(
	JSON_CANONICAL_COMMANDS.canonicalize,
	/** Writes the canonical text, or forwards the input's exit failure untouched. */
	async (ctx) => {
		let canonical = await readCanonical(ctx, ctx.arguments.file);
		if (isFailure(canonical)) return canonical;
		ctx.stdout(ctx.flags.newline ? `${canonical.data}\n` : canonical.data);
		return success();
	},
);
