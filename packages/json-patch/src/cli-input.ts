/**
 * The input side every `sdxc-json-patch` command shares: a file read from a path or stdin, and
 * its text read as JSON. Input that cannot be read or is not JSON is an exit-2 failure, so each
 * handler only forwards it.
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

import type { JSONValue } from "./json-value.js";

/** The exit code for usage errors and input that cannot be read. */
const UNREADABLE = 2;

/** A file's text with the name diagnostics call it by: its path as typed, or `stdin`. */
export interface Input {
	name: string;
	text: string;
}

/**
 * The text at `file`, resolved against the run's directory, or stdin when `file` is `-` or
 * absent. A terminal on stdin fails at once, so a run never waits for typing.
 *
 * @param ctx - The run's directory and stdin
 * @param file - The path argument as typed
 * @returns The text, or an exit-2 failure naming what could not be read
 */
export async function readInput(
	ctx: { cwd: string; stdin: Stdin },
	file: string | undefined,
): Promise<Result<Input, ExitError>> {
	if (file === undefined || file === "-") {
		if (ctx.stdin.isTTY) return exit(UNREADABLE, "No input: pass a file, or pipe one on stdin");
		return success({ name: "stdin", text: await ctx.stdin.text() });
	}
	let read = await wrap(() => readFile(resolve(ctx.cwd, file), "utf8"));
	if (isFailure(read)) return exit(UNREADABLE, `Cannot read ${file}: ${read.error.message}`);
	return success({ name: file, text: read.data });
}

/**
 * The file at `file` read as JSON; a file that is not JSON is an exit-2 failure naming it.
 *
 * @param ctx - The run's directory and stdin
 * @param file - The path argument as typed
 */
export async function readJSON(
	ctx: { cwd: string; stdin: Stdin },
	file: string | undefined,
): Promise<Result<JSONValue, ExitError>> {
	let input = await readInput(ctx, file);
	if (isFailure(input)) return input;
	let parsed: Result<JSONValue, Error> = wrap(
		(): JSONValue => JSON.parse(input.data.text) as JSONValue,
	);
	if (isFailure(parsed)) {
		return exit(UNREADABLE, `${input.data.name} is not JSON: ${parsed.error.message}`);
	}
	return parsed;
}

/** Whether two input arguments both read stdin, which holds only one document; `-` and an absent argument both read it. */
export function bothStdin(first: string | undefined, second: string | undefined): boolean {
	let reads = (file: string | undefined) => file === undefined || file === "-";
	return reads(first) && reads(second);
}

/**
 * A JSON value as the commands print it: indented by two spaces for a person, or on one line
 * with `compact`, always ending in a newline so the output is a well-formed text file.
 */
export function formatJSON(value: unknown, compact: boolean): string {
	return `${JSON.stringify(value, null, compact ? undefined : 2)}\n`;
}
