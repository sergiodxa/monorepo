/**
 * The `sdxc-robots parse` handler: reads a robots.txt from a file, stdin or an origin and prints
 * it normalized through `stringify`, or as the parsed document with `--json`. An origin that
 * answers without a readable file has nothing to print, so it exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { ROBOTS_COMMANDS } from "./cli-contract.js";
import { DEFAULT_FETCH_AGENT, describeFallback, readRobots } from "./cli-source.js";

import type { Robots } from "./index.js";

import { stringify } from "./index.js";

/** Prints the document on stdout; an empty one notes on stderr that it allows every path. */
export default createCommand(ROBOTS_COMMANDS.parse, async (ctx) => {
	let source = await readRobots(ctx, ctx.arguments.source, DEFAULT_FETCH_AGENT);
	if (isFailure(source)) return source;

	let read = source.data;
	let document: Robots.Document;
	if (read.kind === "file") document = read.document;
	else if (read.outcome.status === "parsed") document = read.outcome.document;
	else return exit(2, `${read.from}: ${describeFallback(read.outcome)}`);

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify(document)}\n`);
		return success();
	}

	let text = stringify(document);
	if (text === "") ctx.stderr(`${read.from}: no rules, so every path is allowed\n`);
	else ctx.stdout(text.endsWith("\n") ? text : `${text}\n`);
	return success();
});
