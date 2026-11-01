/**
 * The document every `sdxc-jscontact` command reads: the named file, or stdin when the
 * argument is `-`. A terminal on stdin is a usage error, so a command run with no input
 * answers at once with its help.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ExitError, Stdin, UsageError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit, usage } from "@sdxc/cli";
import { success } from "@sdxc/result";

/** Where a command's input comes from: its working directory and its stdin. */
export interface InputSource {
	cwd: string;
	stdin: Stdin;
}

/**
 * The text of `file`, resolved against the run's directory, or of stdin for `-`.
 *
 * @param file - The path argument as given
 * @param source - The run's directory and stdin
 * @returns The text, or a failure that exits 2 naming what could not be read
 */
export async function readInput(
	file: string,
	source: InputSource,
): Promise<Result<string, ExitError | UsageError>> {
	if (file === "-") {
		if (source.stdin.isTTY) return usage("Pass a file, or pipe one on stdin");
		return success(await source.stdin.text());
	}
	try {
		return success(await readFile(resolve(source.cwd, file), "utf8"));
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot read ${file}: ${reason}`);
	}
}
