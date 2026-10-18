/**
 * The `sdxc doctor` handler: runs every check over the project and prints one line per check,
 * or one JSON document with `--json`, so a person and an agent read the same verdict. It changes
 * nothing; each warning and failure carries the command that fixes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { createDoctorContext, runChecks } from "../doctor/check.js";
import { CHECKS, formatJSON, formatText, hasFailure } from "../doctor/checks.js";
import { project } from "../middleware.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { readManifest } from "../upgrade/project.js";

/** Exits 1 when any check fails; a warning or a skipped check leaves the exit code at 0. */
export default createCommand(SDXC_COMMANDS.doctor, {
	middleware: [project()],
	/** Prints the report to stdout, in the form `--json` picks. */
	async handler(ctx) {
		let root = ctx.project.root;
		let read = await readManifest(root);
		if (isFailure(read)) return read;
		let manager = await packageManager({
			declared: read.data.manifest.packageManager,
			findLockFile: lockFileAtOrAbove(root),
		});
		let context = createDoctorContext({
			root,
			manifest: read.data.manifest,
			manager,
			signal: ctx.signal,
		});
		let reports = await runChecks(CHECKS, context);
		ctx.stdout(ctx.flags.json ? formatJSON(reports) : formatText(reports));
		return hasFailure(reports) ? exit(1) : success();
	},
});
