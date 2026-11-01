/**
 * Loads the page a command was pointed at — an http(s) URL through `HTML.fetch`, a file, or
 * stdin — so every command accepts input the same way and an unreadable one exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ChainContext, ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit } from "@sdxc/cli";
import { isFailure, success } from "@sdxc/result";

import { HTML } from "./index.js";

/**
 * The parsed page `source` names, resolved against the run's directory; `-` reads stdin.
 *
 * @param ctx - The running command, for its directory and stdin
 * @param source - The argument as typed
 * @returns The page, or an exit 2 naming what could not be read
 */
export async function loadPage(
	ctx: Pick<ChainContext, "cwd" | "stdin">,
	source: string,
): Promise<Result<HTML, ExitError>> {
	if (/^https?:\/\//i.test(source)) {
		let page = await HTML.fetch(source);
		if (isFailure(page)) return exit(2, `${source}: ${page.error.message}`);
		return success(page.data);
	}

	let text: string;
	try {
		text =
			source === "-" ? await ctx.stdin.text() : await readFile(resolve(ctx.cwd, source), "utf8");
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot read ${source}: ${reason}`);
	}

	let page = HTML.parse(text);
	if (isFailure(page)) return exit(2, `${source}: ${page.error.message}`);
	return success(page.data);
}
