/**
 * What the `sdxc-zone-file` commands share: reading a zone from a file or stdin, parsing it with
 * `$INCLUDE` files read beside it, and printing a rejection with the file and lines it came from,
 * so every command accepts input and reports problems the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ChainContext, ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit } from "@sdxc/cli";
import { isFailure, success } from "@sdxc/result";

import type * as ZoneFile from "./types.js";

import { parse } from "./parse.js";

/** The text read and the name diagnostics call it by: the path as typed, or `<stdin>`. */
export interface ZoneInputText {
	name: string;
	text: string;
	/** Where `$INCLUDE` paths resolve: the file's directory, or the run's directory for stdin. */
	directory: string;
}

/** The parse defaults the `--origin` and `--ttl` flags set. */
export interface ZoneDefaults {
	origin: string;
	ttl?: number;
}

/**
 * The text of `file`, resolved against the run's directory; `-` reads stdin to its end.
 *
 * @param ctx - The running command, for its directory and stdin
 * @param file - The path argument as typed
 * @returns The input, or an exit 2 naming the file that could not be read
 */
export async function readInput(
	ctx: Pick<ChainContext, "cwd" | "stdin">,
	file: string,
): Promise<Result<ZoneInputText, ExitError>> {
	if (file === "-") {
		return success({ name: "<stdin>", text: await ctx.stdin.text(), directory: ctx.cwd });
	}
	let path = resolve(ctx.cwd, file);
	try {
		return success({ name: file, text: await readFile(path, "utf8"), directory: dirname(path) });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot read ${file}: ${reason}`);
	}
}

/**
 * Parses the input with `$INCLUDE` paths read relative to it; an include that cannot be read
 * becomes an `include` rejection on its line. A zone over the size limit exits 2.
 *
 * @param input - The text and where it came from
 * @param defaults - The origin and TTL the flags set
 */
export function parseInput(
	input: ZoneInputText,
	defaults: ZoneDefaults,
): Result<ZoneFile.Zone, ExitError> {
	let parsed = parse(input.text, {
		origin: defaults.origin,
		ttl: defaults.ttl ?? null,
		include: (fileName) => readInclude(resolve(input.directory, fileName)),
	});
	if (isFailure(parsed)) return exit(2, `${input.name}: ${parsed.error.message}`);
	return parsed;
}

/** An included file's text, or `null` so the parser rejects the `$INCLUDE` that named it. */
function readInclude(path: string): string | null {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
}

/**
 * One problem as `file:line: message (reason)`, with `line-endLine` for a parenthesized entry
 * and the included file's name for an entry read from one.
 *
 * @param name - What the input is called, for entries of the main file
 * @param rejection - The entry the parser could not use
 */
export function describeRejection(name: string, rejection: ZoneFile.Rejection): string {
	let lines =
		rejection.endLine === rejection.line
			? String(rejection.line)
			: `${rejection.line}-${rejection.endLine}`;
	return `${rejection.file ?? name}:${lines}: ${rejection.message} (${rejection.reason})`;
}
