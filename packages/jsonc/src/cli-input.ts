/**
 * The input side both `sdxc-jsonc` commands share: a document read from a path or stdin, with
 * the name a report prints for it. Input that cannot be read exits 2, so each handler only
 * parses and formats.
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

/** The exit code for usage errors and input that cannot be read or parsed. */
export const UNREADABLE = 2;

/** A document read for a command, named as reports print it: the path as typed, or `<stdin>`. */
export interface Input {
	name: string;
	text: string;
}

/**
 * The document at `file`, resolved against the run's directory, or stdin when `file` is `-` or
 * absent. A terminal on stdin fails at once, so a run never waits for typing.
 *
 * @param ctx - The run's directory and stdin
 * @param file - The path argument as typed
 */
export async function readInput(
	ctx: { cwd: string; stdin: Stdin },
	file: string | undefined,
): Promise<Result<Input, ExitError>> {
	if (file === undefined || file === "-") {
		if (ctx.stdin.isTTY) return exit(UNREADABLE, "No input: pass a file, or pipe one on stdin");
		return success({ name: "<stdin>", text: await ctx.stdin.text() });
	}
	let read = await wrap(() => readFile(resolve(ctx.cwd, file), "utf8"));
	if (isFailure(read)) return exit(UNREADABLE, `Cannot read ${file}: ${read.error.message}`);
	return success({ name: file, text: read.data });
}
