/**
 * The `sdxc-jsonpath query` handler: parses the expression with `JSONPath.parse`, reads the
 * document from a file or stdin, and prints the selected values or normalized paths as JSON,
 * so its output pipes into any other JSON tool.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ChainContext, ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSONPATH_COMMANDS } from "./cli-contract.js";

import type { JSONValue } from "./index.js";

import { JSONPath } from "./index.js";

/**
 * The message of a thrown value, which a filesystem or `JSON.parse` failure carries as an `Error`.
 *
 * @param error - What was thrown
 */
function reasonOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * The parsed document `file` names, resolved against the run's directory; `-` reads stdin.
 * A file that cannot be read or is not JSON exits 2 naming it.
 *
 * @param ctx - The running command, for its directory and stdin
 * @param file - The path argument as typed
 */
async function readDocument(
	ctx: Pick<ChainContext, "cwd" | "stdin">,
	file: string,
): Promise<Result<JSONValue, ExitError>> {
	let name = file === "-" ? "<stdin>" : file;
	let text: string;
	try {
		text = file === "-" ? await ctx.stdin.text() : await readFile(resolve(ctx.cwd, file), "utf8");
	} catch (error) {
		return exit(2, `Cannot read ${name}: ${reasonOf(error)}`);
	}
	try {
		let document = JSON.parse(text) as JSONValue;
		return success(document);
	} catch (error) {
		return exit(2, `${name} is not JSON: ${reasonOf(error)}`);
	}
}

/**
 * The parse error with the expression underneath and a caret at the failing offset, so a
 * long filter shows exactly where it broke.
 *
 * @param expression - The expression as typed
 * @param message - The parser's message, which names the offset
 * @param offset - The UTF-16 offset of the problem
 */
function describeSyntaxError(expression: string, message: string, offset: number): string {
	return `Invalid JSONPath expression: ${message}\n  ${expression}\n  ${" ".repeat(offset)}^`;
}

/**
 * Prints a JSON array of the matches, one value per match (`--paths`: one normalized path),
 * or with `--first` the first match alone and nothing when there is none. Nothing selected
 * exits 0 unless `--fail-empty` makes it exit 1.
 */
export default createCommand(JSONPATH_COMMANDS.query, async (ctx) => {
	let { expression, file } = ctx.arguments;
	let parsed = JSONPath.parse(expression);
	if (isFailure(parsed)) {
		let { message, offset } = parsed.error;
		return exit(2, describeSyntaxError(expression, message, offset));
	}

	let document = await readDocument(ctx, file);
	if (isFailure(document)) return document;

	let nodes = parsed.data.select(document.data);
	let matches = nodes.map((node) => (ctx.flags.paths ? node.path : node.value));

	if (ctx.flags.first) {
		if (matches.length > 0) ctx.stdout(`${JSON.stringify(matches[0], null, 2)}\n`);
	} else {
		ctx.stdout(`${JSON.stringify(matches, null, 2)}\n`);
	}

	if (matches.length === 0 && ctx.flags.failEmpty) return exit(1, "No match");
	return success();
});
