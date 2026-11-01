/**
 * The `sdxc-json-patch validate` handler: reads a patch with `parse` and reports whether it is
 * a JSON Patch document. An invalid patch is the finding the check exists for, so it exits 1;
 * only an unreadable file exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSON_PATCH_COMMANDS } from "./cli-contract.js";
import { readInput } from "./cli-input.js";

import { parse } from "./index.js";

/**
 * Prints `<file>: <n> operations`, or `<file>: <problem>` on stderr; `--json` prints
 * `{ valid, operations }` or `{ valid, index, message }` on stdout in both cases.
 */
export default createCommand(JSON_PATCH_COMMANDS.validate, async (ctx) => {
	let input = await readInput(ctx, ctx.arguments.patch);
	if (isFailure(input)) return input;

	let patch = parse(input.data.text);
	if (!isFailure(patch)) {
		let operations = patch.data.length;
		ctx.stdout(
			ctx.flags.json
				? `${JSON.stringify({ valid: true, operations })}\n`
				: `${input.data.name}: ${operations} ${operations === 1 ? "operation" : "operations"}\n`,
		);
		return success();
	}

	let { index, message } = patch.error;
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ valid: false, index, message })}\n`);
		return exit(1);
	}
	return exit(1, `${input.data.name}: ${message}`);
});
