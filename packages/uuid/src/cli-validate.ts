/**
 * The `sdxc-uuid validate` handler: checks one UUID from an argument or stdin with the
 * package's `assertUUID`, and reports its version and, for v7, the time it was generated.
 * An invalid value exits 1 with the reason, so a script can branch on the exit code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { isFailure, wrap } from "@sdxc/result";

import { UUID_COMMANDS } from "./cli-contract.js";
import { getTimestamp } from "./v7.js";

import { assertUUID, getVersion } from "./index.js";

/**
 * Prints `valid`, the version and the v7 creation time, or `invalid` and the reason; `--json`
 * prints `{ valid, uuid, version, timestamp? }` or `{ valid, uuid, error }`. Stdin loses one
 * trailing line ending, so `echo $ID |` checks the id itself.
 */
export default createCommand(UUID_COMMANDS.validate, async (ctx) => {
	let value = ctx.arguments.uuid ?? "-";
	if (value === "-") {
		if (ctx.stdin.isTTY) return usage("Pass a UUID, or pipe one on stdin");
		value = (await ctx.stdin.text()).replace(/\r?\n$/, "");
	}

	let checked = wrap(() => {
		assertUUID(value);
		return value;
	});
	if (isFailure(checked)) {
		ctx.stdout(
			ctx.flags.json
				? `${JSON.stringify({ valid: false, uuid: value, error: checked.error.message })}\n`
				: `invalid: ${checked.error.message}\n`,
		);
		return exit(1);
	}

	let uuid = checked.data;
	let version = getVersion(uuid);
	let timestamp = version === 7 ? new Date(getTimestamp(uuid)).toISOString() : undefined;

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ valid: true, uuid, version, timestamp })}\n`);
		return success();
	}
	let lines = ["valid", `version ${version}`];
	if (timestamp !== undefined) lines.push(`timestamp ${timestamp}`);
	ctx.stdout(`${lines.join("\n")}\n`);
	return success();
});
