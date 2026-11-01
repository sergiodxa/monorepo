/**
 * Reads the sitemap a command was pointed at, from an http(s) URL, a file or stdin, so `list`
 * and `validate` accept input the same way and report what they could not read with exit 2.
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

/**
 * The sitemap's text and the name diagnostics call it by; `location` is set for a fetched
 * sitemap, whose host the protocol requires every URL in it to share.
 */
export interface SitemapInput {
	name: string;
	source: string;
	location?: URL;
}

/**
 * The text of `source`: fetched when it is an http(s) URL, read from stdin when it is `-`, and
 * otherwise read as a path resolved against the run's directory.
 *
 * @param ctx - The running command, for its directory and stdin
 * @param source - The argument as typed
 * @returns The input, or an exit 2 naming what could not be read
 */
export async function readSitemapInput(
	ctx: Pick<ChainContext, "cwd" | "stdin" | "signal">,
	source: string,
): Promise<Result<SitemapInput, ExitError>> {
	if (source === "-") return success({ name: "<stdin>", source: await ctx.stdin.text() });
	if (/^https?:\/\//i.test(source)) return fetchSitemap(ctx, source);
	try {
		return success({ name: source, source: await readFile(resolve(ctx.cwd, source), "utf8") });
	} catch (error) {
		return exit(2, `Cannot read ${source}: ${reasonOf(error)}`);
	}
}

/** Fetches a sitemap's text, taking any `ok` response whatever its content type. */
async function fetchSitemap(
	ctx: Pick<ChainContext, "signal">,
	source: string,
): Promise<Result<SitemapInput, ExitError>> {
	let response: Response;
	try {
		response = await fetch(source, { signal: ctx.signal });
	} catch (error) {
		return exit(2, `Cannot fetch ${source}: ${reasonOf(error)}`);
	}
	if (!response.ok) {
		void response.body?.cancel().catch(() => undefined);
		return exit(2, `Cannot fetch ${source}: ${response.status}`);
	}
	return success({ name: source, source: await response.text(), location: new URL(source) });
}

/** The message of whatever was thrown. */
function reasonOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
