/**
 * `release check-commits`: fails when a commit has no release-note body or a lowercase summary,
 * for the commit-msg hook (`--message-file`) and for CI over a revision range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { runCheckCommits } from "../../scripts/release/check-commits.js";

import commandset from "./index.js";

/** Checks a message file or a revision range and prints a short report when every commit passes. */
export default createCommand(commandset.release["check-commits"], async (ctx) => {
	if (ctx.flags.messageFile === undefined && ctx.arguments.range === undefined) {
		return usage("Pass a revision range or --message-file <path>");
	}
	let ran = await runCheckCommits({
		messageFile: ctx.flags.messageFile,
		range: ctx.arguments.range,
	});
	if (isFailure(ran)) return exit(1, ran.error.message);
	if (ran.data !== "") ctx.stdout(`${ran.data}\n`);
	return success();
});
