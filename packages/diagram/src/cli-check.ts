/**
 * The `sdxc-diagram check` handler: reads a Mermaid diagram with `parseDiagram` and reports
 * whether it stays inside the supported subset. Unsupported syntax is the finding the check
 * exists for, so it exits 1; only an unreadable file exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { DIAGRAM_COMMANDS } from "./cli-contract.js";
import { readDiagramInput } from "./cli-source.js";

import { parseDiagram } from "./index.js";

/**
 * Prints `file: ok`, or `file:line:column reason` on stderr; `--json` prints
 * `{ valid, reason, line, column }` on stdout in both cases, the position only when invalid.
 */
export default createCommand(DIAGRAM_COMMANDS.check, async (ctx) => {
	let input = await readDiagramInput(ctx, ctx.arguments.file);
	if (isFailure(input)) return input;

	let parsed = parseDiagram(input.data.source);
	if (!isFailure(parsed)) {
		ctx.stdout(
			ctx.flags.json ? `${JSON.stringify({ valid: true })}\n` : `${input.data.name}: ok\n`,
		);
		return success();
	}

	let { line, column, reason } = parsed.error;
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ valid: false, reason, line, column })}\n`);
		return exit(1);
	}
	return exit(1, `${input.data.name}:${line}:${column} ${reason}`);
});
