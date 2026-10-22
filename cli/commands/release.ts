/**
 * `release`: plans and optionally publishes today's dated @sdxc package release, the same path
 * CI runs. Without `--publish` it is a dry run that builds and prints what would ship.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { runRelease } from "../../scripts/release/main.js";

import commandset from "./index.js";

/** Runs the daily release with this command's flags. */
export default createCommand(commandset.release, async (ctx) => {
	let ran = await runRelease({
		publish: ctx.flags.publish,
		force: ctx.flags.force,
		say: (text) => ctx.stdout(`${text}\n`),
	});
	if (isFailure(ran)) return exit(1, ran.error.message);
	return success();
});
