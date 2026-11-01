/**
 * The `sdxc-semver sort` handler: orders versions given as arguments, or one per line on
 * stdin, by SemVer 2.0.0 precedence, so `git tag | sdxc-semver sort` lists releases in the
 * order they shipped rather than character by character.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SEMVER_COMMANDS } from "./cli-contract.js";
import { compare } from "./compare.js";
import { parse } from "./parse.js";

/**
 * Prints the versions as given, one per line or as a JSON array under `--json`. Stdin lines
 * are trimmed and blank ones skipped; versions ranking equally keep their input order, and
 * every entry that is not a version is named on stderr before the run exits 2.
 */
export default createCommand(SEMVER_COMMANDS.sort, async (ctx) => {
	let versions = ctx.arguments.versions;

	if (versions.length === 0) {
		if (ctx.stdin.isTTY) return usage("Pass versions, or pipe them on stdin one per line");
		versions = (await ctx.stdin.text())
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "");
	}

	let rejected: string[] = [];
	for (let text of versions) {
		let parsed = parse(text);
		if (isFailure(parsed)) rejected.push(parsed.error.message);
	}
	if (rejected.length > 0) return exit(2, rejected.join("\n"));

	let sorted = [...versions].sort(ctx.flags.reverse ? (a, b) => compare(b, a) : compare);

	if (ctx.flags.json) ctx.stdout(`${JSON.stringify(sorted)}\n`);
	else ctx.stdout(sorted.map((version) => `${version}\n`).join(""));
	return success();
});
