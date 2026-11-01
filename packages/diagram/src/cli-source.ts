/**
 * Reads the Mermaid source a command was pointed at, from a file or from stdin, so `render` and
 * `check` accept input the same way and report an unreadable file with the same exit code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ChainContext, ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit } from "@sdxc/cli";
import { success } from "@sdxc/result";

/** The source and the name diagnostics call it by: the path as typed, or `<stdin>`. */
export interface DiagramInput {
	name: string;
	source: string;
}

/**
 * The text of `file`, resolved against the run's directory; `-` reads stdin to its end.
 *
 * @param ctx - The running command, for its directory and stdin
 * @param file - The path argument as typed
 * @returns The input, or an exit 2 naming the file that could not be read
 */
export async function readDiagramInput(
	ctx: Pick<ChainContext, "cwd" | "stdin">,
	file: string,
): Promise<Result<DiagramInput, ExitError>> {
	if (file === "-") return success({ name: "<stdin>", source: await ctx.stdin.text() });
	try {
		return success({ name: file, source: await readFile(resolve(ctx.cwd, file), "utf8") });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot read ${file}: ${reason}`);
	}
}
