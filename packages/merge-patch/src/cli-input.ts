/**
 * The input and output every `sdxc-merge-patch` command shares: JSON documents read from a path
 * or stdin, and the result written back as JSON text. Input that cannot be read or is not JSON
 * is an exit-2 failure, so each handler only forwards it.
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

import { parse } from "./parse.js";

/** The exit code for usage errors and input that cannot be read. */
const UNREADABLE = 2;

/** What reading a document needs from the run: its directory and stdin. */
interface InputContext {
	cwd: string;
	stdin: Stdin;
}

/**
 * The document at `file`, resolved against the run's directory, or stdin when `file` is `-` or
 * absent, parsed as JSON. A terminal on stdin fails at once, so a run never waits for input.
 *
 * @param ctx - The run's directory and stdin
 * @param file - The path argument as typed
 * @returns The JSON value, or an exit-2 failure naming the input that could not be read
 */
export async function readDocument(
	ctx: InputContext,
	file: string | undefined,
): Promise<Result<JSONValue, ExitError>> {
	let label = isStdin(file) ? "stdin" : file;
	let text = await readText(ctx, file);
	if (isFailure(text)) return text;
	let value = parse(text.data);
	if (isFailure(value)) return exit(UNREADABLE, `${label} is not JSON: ${value.error.message}`);
	return value;
}

/**
 * Whether an argument names stdin, so a handler can refuse two inputs that both read it.
 *
 * @param file - The path argument as typed
 */
export function isStdin(file: string | undefined): file is "-" | undefined {
	return file === undefined || file === "-";
}

/**
 * The text of a JSON value as the command prints it: indented with two spaces, or on one line
 * with `compact`, always ending in a newline.
 *
 * @param value - The document or patch to print
 * @param compact - Whether to print it on one line
 */
export function formatJSON(value: JSONValue, compact: boolean): string {
	return `${compact ? JSON.stringify(value) : JSON.stringify(value, null, 2)}\n`;
}

/** The raw text of one input, from the file or from stdin. */
async function readText(
	ctx: InputContext,
	file: string | undefined,
): Promise<Result<string, ExitError>> {
	if (isStdin(file)) {
		if (ctx.stdin.isTTY) return exit(UNREADABLE, "No input: pass a file, or pipe one on stdin");
		return success(await ctx.stdin.text());
	}
	let read = await wrap(() => readFile(resolve(ctx.cwd, file), "utf8"));
	if (isFailure(read)) return exit(UNREADABLE, `Cannot read ${file}: ${read.error.message}`);
	return success(read.data);
}
