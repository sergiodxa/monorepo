/**
 * The `sdxc-diagram render` handler: draws a Mermaid diagram with `toSVG` and writes the markup
 * to stdout or a file. A diagram the package cannot read is bad input, so it exits 2 with
 * `file:line:column reason`, the place an editor jumps to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { DIAGRAM_COMMANDS } from "./cli-contract.js";
import { readDiagramInput } from "./cli-source.js";

import { toSVG } from "./index.js";

/**
 * Writes the SVG followed by a newline, so a file ends the way text files do and a terminal
 * prompt starts on its own line.
 */
export default createCommand(DIAGRAM_COMMANDS.render, async (ctx) => {
	let input = await readDiagramInput(ctx, ctx.arguments.file);
	if (isFailure(input)) return input;

	let svg = toSVG(input.data.source, { alt: ctx.flags.alt });
	if (isFailure(svg)) {
		let { line, column, reason } = svg.error;
		return exit(2, `${input.data.name}:${line}:${column} ${reason}`);
	}

	if (ctx.flags.output === undefined) {
		ctx.stdout(`${svg.data}\n`);
		return success();
	}
	try {
		await writeFile(resolve(ctx.cwd, ctx.flags.output), `${svg.data}\n`, "utf8");
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot write ${ctx.flags.output}: ${reason}`);
	}
	ctx.stderr(`Wrote ${ctx.flags.output}\n`);
	return success();
});
