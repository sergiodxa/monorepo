/**
 * The `sdxc-user-agent parse` handler: reads one User-Agent string from its argument, or one per
 * line of stdin, and prints what each describes on a line of its own, so a log's column of
 * strings pipes through it and comes out in the same order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";

import type { UserAgent } from "./types.js";

import { USER_AGENT_COMMANDS } from "./cli-contract.js";
import { parse } from "./parse.js";

/** The given parts joined by a space, or `-` when the string revealed none of them. */
function field(...parts: (string | null)[]): string {
	let known = parts.filter((part) => part !== null);
	return known.length > 0 ? known.join(" ") : "-";
}

/** Browser, engine, operating system and device as tab-separated columns, for `cut` and `awk`. */
function format({ browser, engine, os, device }: UserAgent): string {
	return [
		field(browser.name, browser.version),
		field(engine.name, engine.version),
		field(os.name, os.version),
		field(device.type, device.vendor, device.model),
	].join("\t");
}

/**
 * Prints one line per string: four tab-separated columns, or the parsed `UserAgent` as one JSON
 * object with `--json`. Blank stdin lines are skipped; every string parses, so the run exits 0.
 */
export default createCommand(USER_AGENT_COMMANDS.parse, async (ctx) => {
	let strings = [ctx.arguments.ua];
	if (ctx.arguments.ua === "-") {
		if (ctx.stdin.isTTY) return usage("Pass a User-Agent string, or pipe one per line on stdin");
		strings = (await ctx.stdin.text()).split(/\r?\n/).filter((line) => line.trim() !== "");
	}
	for (let string of strings) {
		let parsed = parse(string);
		ctx.stdout(`${ctx.flags.json ? JSON.stringify(parsed) : format(parsed)}\n`);
	}
	return success();
});
