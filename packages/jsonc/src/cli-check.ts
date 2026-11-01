/**
 * The `check` handler: parses a JSONC document and prints each error the package reports as
 * `file:line:column: reason`, the shape editors and CI annotations link to, exiting 1 on any so
 * a pipeline can gate on a `tsconfig.json` or `wrangler.jsonc`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSONC_COMMANDS } from "./cli-contract.js";
import { readInput } from "./cli-input.js";
import { parse } from "./parse.js";

/** The exit code for a document that was read and found invalid. */
const PROBLEMS_FOUND = 1;

export default createCommand(
	JSONC_COMMANDS.check,
	/**
	 * Confirms a valid document, or lists its errors and exits 1; `--json` prints
	 * `{ valid, errors }`, each error `{ line, column, offset, reason, message }`.
	 */
	async (ctx) => {
		let input = await readInput(ctx, ctx.arguments.file);
		if (isFailure(input)) return input;
		let { name, text } = input.data;
		let parsed = parse(text);
		let errors = isFailure(parsed) ? [parsed.error] : [];

		if (ctx.flags.json) {
			let report = {
				valid: errors.length === 0,
				errors: errors.map(({ line, column, offset, reason, message }) => ({
					line,
					column,
					offset,
					reason,
					message,
				})),
			};
			ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
		} else if (errors.length === 0) {
			ctx.stdout(`${name} is valid JSONC\n`);
		} else {
			for (let error of errors) {
				ctx.stdout(`${name}:${error.line}:${error.column}: ${error.reason}\n`);
			}
		}
		return errors.length === 0 ? success() : exit(PROBLEMS_FOUND);
	},
);
