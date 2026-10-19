/**
 * The `sdxc doctor` handler: runs every built-in check and every check the project defines, and
 * prints one line per check, or one JSON document with `--json`, so a person and an agent read
 * the same verdict. It changes nothing; each warning and failure carries the command that fixes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { failure, isFailure, wrap } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { createDoctorContext, runChecks } from "../doctor/check.js";
import { CHECKS, formatJSON, formatText, hasFailure } from "../doctor/checks.js";
import { runProjectChecks, selects } from "../doctor/project.js";
import { packageRoot, project } from "../middleware.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { listRoutes } from "../routes/index.js";
import { readManifest } from "../upgrade/project.js";

/**
 * Exits 1 when any check fails; a warning or a skipped check leaves the exit code at 0. A name
 * in `--only` or `--skip` that no check has ends the run with the names there are.
 */
export default createCommand(SDXC_COMMANDS.doctor, {
	middleware: [project(), packageRoot()],
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
			config: ctx.project.config,
			manager,
			packageRoot: ctx.packageRoot,
			signal: ctx.signal,
		});
		let selection = { only: ctx.flags.only ?? [], skip: ctx.flags.skip ?? [] };
		let builtIn = CHECKS.map((check) => check.name);
		let reports = await runChecks(
			CHECKS.filter((check) => selects(selection, check.name)),
			context,
		);
		let raw = wrap(() => JSON.parse(read.data.text) as Record<string, unknown>);
		let own = await runProjectChecks(ctx, {
			root,
			runtime: manager.name === "bun" ? "bun" : "node",
			manifest: isFailure(raw) ? {} : raw.data,
			config: ctx.project.config,
			routes: async () => (await listRoutes(root)).routes,
			builtIn,
			selection,
		});
		let known = new Set([...builtIn, ...own.names]);
		let unknown = [...selection.only, ...selection.skip].filter((name) => !known.has(name));
		if (unknown.length > 0) {
			return failure(
				new Error(
					`No check is named ${unknown.join(", ")}; sdxc doctor runs ${[...known].join(", ")}`,
				),
			);
		}
		reports.push(...own.reports);
		ctx.stdout(ctx.flags.json ? formatJSON(reports) : formatText(reports));
		return hasFailure(reports) ? exit(1) : success();
	},
});
