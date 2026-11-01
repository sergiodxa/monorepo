/**
 * The input side both `sdxc-json-canonical` commands share: a document read from a path or
 * stdin, parsed as JSON and canonicalized. Unreadable or unparseable input exits 2, and JSON
 * the package refuses exits 1 naming its pointer, so each handler only formats the result.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ExitError, Stdin } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit } from "@sdxc/cli";
import { isFailure, success, wrap } from "@sdxc/result";

import { canonicalize } from "./canonicalize.js";

/** The exit code for usage errors and input that cannot be read or parsed. */
const UNREADABLE = 2;

/** The exit code for a JSON document the canonicalization refuses. */
const REFUSED = 1;

/**
 * The document's text: the file at `file`, resolved against the run's directory, or stdin
 * when `file` is `-` or absent. A terminal on stdin fails at once, so a run never waits.
 *
 * @param ctx - The run's directory and stdin
 * @param file - The path argument as typed
 */
async function readInput(
	ctx: { cwd: string; stdin: Stdin },
	file: string | undefined,
): Promise<Result<{ name: string; text: string }, ExitError>> {
	if (file === undefined || file === "-") {
		if (ctx.stdin.isTTY) return exit(UNREADABLE, "No input: pass a file, or pipe one on stdin");
		return success({ name: "<stdin>", text: await ctx.stdin.text() });
	}
	let read = await wrap(() => readFile(resolve(ctx.cwd, file), "utf8"));
	if (isFailure(read)) return exit(UNREADABLE, `Cannot read ${file}: ${read.error.message}`);
	return success({ name: file, text: read.data });
}

/**
 * The canonical JSON text of the document at `file` (or stdin), ready to print or encode.
 *
 * @param ctx - The run's directory and stdin
 * @param file - The path argument as typed
 * @returns The canonical text, or an exit failure naming the input and what was wrong with it
 */
export async function readCanonical(
	ctx: { cwd: string; stdin: Stdin },
	file: string | undefined,
): Promise<Result<string, ExitError>> {
	let input = await readInput(ctx, file);
	if (isFailure(input)) return input;
	let parsed = wrap((): unknown => JSON.parse(input.data.text));
	if (isFailure(parsed)) {
		return exit(UNREADABLE, `${input.data.name} is not JSON: ${parsed.error.message}`);
	}
	let canonical = canonicalize(parsed.data);
	if (isFailure(canonical)) {
		let pointer = canonical.error.pointer === "" ? "the root" : canonical.error.pointer;
		return exit(REFUSED, `${input.data.name} at ${pointer}: ${canonical.error.message}`);
	}
	return canonical;
}
