/**
 * `doctor`: runs the workspace kit's `sdxc doctor` in every app under `apps/`, the way CI does,
 * and exits 1 when any app fails. `--json`, `--only` and `--skip` reach every run alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { join } from "node:path";

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { REPO_ROOT } from "../../scripts/release/workspace.js";
import { listApps } from "../apps.js";

import commandset from "./index.js";

/** The kit's command line in this checkout, so the run checks against the kit being changed. */
const KIT_BIN = join(REPO_ROOT, "packages/kit/src/bin.ts");

/** GitHub Actions folds each app's report under a collapsible group in the job log. */
const IN_ACTIONS = process.env.GITHUB_ACTIONS === "true";

/** Tokens to pass through to each app's `sdxc doctor` from this command's flags. */
function doctorArgs(flags: { json: boolean; only: string[]; skip: string[] }): string[] {
	let args: string[] = [];
	if (flags.json) args.push("--json");
	for (let check of flags.only) args.push("--only", check);
	for (let check of flags.skip) args.push("--skip", check);
	return args;
}

/**
 * Runs doctor in each app, its report folded under the app's name, and exits 1 when any app
 * failed so one broken app cannot hide the others' reports.
 */
export default createCommand(commandset.doctor, async (ctx) => {
	let failed: string[] = [];
	let args = doctorArgs(ctx.flags);
	for (let app of listApps()) {
		ctx.stdout(IN_ACTIONS ? `::group::${app}\n` : `\n== ${app}\n`);
		let ran = await ctx.exec(["bun", KIT_BIN, "doctor", ...args], {
			cwd: join(REPO_ROOT, app),
			stdio: "inherit",
		});
		if (IN_ACTIONS) ctx.stdout("::endgroup::\n");
		if (isFailure(ran)) {
			failed.push(app);
			if (IN_ACTIONS) {
				ctx.stdout(`::error title=sdxc doctor::${app} failed sdxc doctor\n`);
			}
		}
	}
	if (failed.length > 0) {
		return exit(1, `sdxc doctor failed in ${failed.join(", ")}`);
	}
	return success();
});
