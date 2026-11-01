/**
 * The `sdxc-semver valid` handler: checks one version against the SemVer 2.0.0 grammar and
 * prints it in the form precedence reads, so a script can strip a tag's `v` in the same call
 * that validates it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SEMVER_COMMANDS } from "./cli-contract.js";
import { parse } from "./parse.js";

/**
 * Prints `major.minor.patch[-prerelease]`, or under `--json` the parsed parts with `valid`.
 * An invalid version exits 1, with the reason on stderr or as `{ valid: false, error }`.
 */
export default createCommand(SEMVER_COMMANDS.valid, (ctx) => {
	let text = ctx.arguments.version;
	let parsed = parse(text);

	if (isFailure(parsed)) {
		if (!ctx.flags.json) return exit(1, parsed.error.message);
		ctx.stdout(`${JSON.stringify({ valid: false, input: text, error: parsed.error.message })}\n`);
		return exit(1);
	}

	let { major, minor, patch, prerelease } = parsed.data;
	let core = `${major}.${minor}.${patch}`;
	let version = prerelease.length === 0 ? core : `${core}-${prerelease.join(".")}`;

	if (ctx.flags.json) {
		ctx.stdout(
			`${JSON.stringify({ valid: true, input: text, version, major, minor, patch, prerelease })}\n`,
		);
	} else {
		ctx.stdout(`${version}\n`);
	}
	return success();
});
