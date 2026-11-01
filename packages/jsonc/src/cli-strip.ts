/**
 * The `strip` handler: prints a JSONC document as plain JSON for tools that read only JSON.
 * By default the output is the package's same-length strip, so a position in it is a position
 * in the source; `--indent` reformats the parsed value instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSONC_COMMANDS } from "./cli-contract.js";
import { readInput, UNREADABLE } from "./cli-input.js";
import { parse } from "./parse.js";
import { strip } from "./strip.js";

export default createCommand(
	JSONC_COMMANDS.strip,
	/**
	 * Writes the JSON, or exits 2 at the first parse error, so stdout only ever carries text
	 * `JSON.parse` accepts.
	 */
	async (ctx) => {
		let input = await readInput(ctx, ctx.arguments.file);
		if (isFailure(input)) return input;
		let { name, text } = input.data;
		let parsed = parse(text);
		if (isFailure(parsed)) {
			let { line, column, reason } = parsed.error;
			return exit(UNREADABLE, `${name}:${line}:${column}: ${reason}`);
		}
		if (ctx.flags.indent === undefined) {
			ctx.stdout(strip(text));
		} else {
			ctx.stdout(`${JSON.stringify(parsed.data, null, ctx.flags.indent)}\n`);
		}
		return success();
	},
);
