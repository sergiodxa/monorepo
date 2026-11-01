/**
 * The `sdxc-jscontact validate` handler: checks one Card, or a JSON array of them, against
 * RFC 9553 and RFC 9982 and reports every problem with the path it was found at. Exits 1 when
 * a Card is invalid and 2 when the input is not JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSCONTACT_COMMANDS } from "./cli-contract.js";
import { readInput } from "./cli-input.js";

import type { Issue } from "./index.js";

import { parse } from "./index.js";

/**
 * Every problem in `value`: the issues of the Card itself, or of each Card of an array with
 * its index leading the path.
 */
function issuesOf(value: unknown): Issue[] {
	if (!Array.isArray(value)) {
		let parsed = parse(value);
		return isFailure(parsed) ? parsed.error.issues : [];
	}
	return value.flatMap((card, index) =>
		issuesOf(card).map((issue) => ({ ...issue, path: [index, ...issue.path] })),
	);
}

/**
 * Prints `valid` or one `path: message` line per problem on stdout, or `{ valid, issues }`
 * with `--json`, so a script reads the same report a person does.
 */
export default createCommand(JSCONTACT_COMMANDS.validate, async (ctx) => {
	let text = await readInput(ctx.arguments.file, ctx);
	if (isFailure(text)) return text;
	let value: unknown;
	try {
		value = JSON.parse(text.data);
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `The input is not JSON: ${reason}`);
	}

	let issues = issuesOf(value);
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ valid: issues.length === 0, issues }, null, 2)}\n`);
	} else if (issues.length === 0) {
		ctx.stdout("valid\n");
	} else {
		for (let issue of issues) {
			let where = issue.path.length > 0 ? issue.path.join(".") : "(card)";
			ctx.stdout(`${where}: ${issue.message}\n`);
		}
	}
	return issues.length === 0 ? success() : exit(1);
});
