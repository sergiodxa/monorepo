/**
 * Reads the robots.txt a command was pointed at: a file, stdin, or an origin's file retrieved
 * with `fetchRobots`. `check` and `parse` share it, so both accept the same sources and report
 * an unreadable file with the same exit code.
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

import type { RobotsFetch } from "./fetch.js";

import { fetchRobots } from "./fetch.js";

import type { Robots } from "./index.js";

import { parse, robotsUrl } from "./index.js";

/** The user-agent a retrieval sends when the caller names no agent. */
export const DEFAULT_FETCH_AGENT = "sdxc-robots";

/**
 * A robots.txt as a command read it, with `from` naming it in reports: the path as typed,
 * `<stdin>`, or the robots.txt URL. A retrieval keeps its whole outcome, so an origin with no
 * readable file still decides as RFC 9309 says.
 */
export type RobotsSource =
	| { kind: "file"; from: string; document: Robots.Document }
	| { kind: "fetched"; from: string; outcome: RobotsFetch.Outcome };

/**
 * Whether text names an origin to fetch rather than a file.
 *
 * @param text - A command's argument as typed
 */
export function isWebUrl(text: string): boolean {
	return /^https?:\/\//i.test(text);
}

/**
 * Reads `source`: an `http(s)` URL fetches that origin's robots.txt, `-` reads stdin to its end,
 * and anything else is a path resolved against the run's directory.
 *
 * @param ctx - The running command, for its directory, stdin and abort signal
 * @param source - The file, URL or `-` as typed
 * @param userAgent - The `User-Agent` a retrieval sends
 * @returns The source, or an exit 2 naming the file that could not be read
 */
export async function readRobots(
	ctx: Pick<ChainContext, "cwd" | "stdin" | "signal">,
	source: string,
	userAgent: string,
): Promise<Result<RobotsSource, ExitError>> {
	if (isWebUrl(source)) {
		let outcome = await fetchRobots(source, { userAgent, signal: ctx.signal });
		return success({ kind: "fetched", from: robotsUrl(source) ?? source, outcome });
	}

	if (source === "-") {
		return success({ kind: "file", from: "<stdin>", document: parse(await ctx.stdin.text()) });
	}

	try {
		let text = await readFile(resolve(ctx.cwd, source), "utf8");
		return success({ kind: "file", from: source, document: parse(text) });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot read ${source}: ${reason}`);
	}
}

/**
 * Why an origin's rules could not be read, and the decision RFC 9309 assigns that case.
 *
 * @param outcome - An unavailable or unreachable retrieval
 */
export function describeFallback(
	outcome: RobotsFetch.Unavailable | RobotsFetch.Unreachable,
): string {
	let status = outcome.httpStatus === null ? "no response" : `HTTP ${outcome.httpStatus}`;
	if (outcome.status === "unavailable") {
		return `robots.txt unavailable (${status}): every path is allowed`;
	}
	return `robots.txt unreachable (${status}): every path is disallowed`;
}
