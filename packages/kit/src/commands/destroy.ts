/**
 * The `sdxc destroy` handler: prints what it removes and edits, asks once, then deletes the
 * files, makes the edits, runs the project's `format` over the edited files, and ends with every
 * reference left for the user to remove.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { isFailure, wrap } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { planDestroy } from "../destroy.js";
import { unifiedDiff } from "../diff.js";
import { formatFiles } from "../format.js";
import { project } from "../middleware.js";

/** Removes what `sdxc make` wrote for one kind and name, after one confirmation. */
export default createCommand(SDXC_COMMANDS.destroy, {
	middleware: [project()],
	/**
	 * Nothing changes without a yes: `--yes`, or a terminal answer after the plan; without a
	 * terminal, a missing `--yes` is a usage error. `--dry-run` prints the plan and the diffs.
	 */
	async handler(ctx) {
		let { yes, dryRun, resource } = ctx.flags;
		if (!yes && !dryRun && !ctx.stdin.isTTY) {
			return usage("Destroying files without a terminal needs --yes");
		}
		let { root, config } = ctx.project;
		let plan = await planDestroy(root, {
			kind: ctx.arguments.kind,
			name: ctx.arguments.name,
			resource,
		});
		if (isFailure(plan)) return plan;
		let { remove, edits, references, notes } = plan.data;
		let lines = [
			"Removes:",
			...remove.map((path) => `  ${path}`),
			...(edits.length === 0 ? [] : ["Edits:", ...edits.map((edit) => `  ${edit.path}`)]),
		];
		ctx.stdout(`${lines.join("\n")}\n`);
		let leftovers = [
			...(references.length === 0
				? []
				: [
						`Still referenced, to remove by hand:\n${references.map((line) => `  ${line}`).join("\n")}\n`,
					]),
			...notes,
		];
		if (dryRun) {
			for (let edit of edits) ctx.stdout(unifiedDiff(edit.path, edit.before, edit.after));
			for (let leftover of leftovers) ctx.stdout(leftover);
			return success();
		}
		if (!yes) {
			let confirmed = await ctx.prompt.confirm({
				message: `Remove ${remove.length} file${remove.length === 1 ? "" : "s"}${edits.length === 0 ? "" : ` and edit ${edits.length}`}?`,
				default: false,
				name: "confirm",
			});
			if (isFailure(confirmed)) return confirmed;
			if (!confirmed.data) return exit(1, "Not confirmed; nothing was removed");
		}
		let applied = await wrap(async () => {
			for (let path of remove) await rm(join(root, path));
			for (let edit of edits) await writeFile(join(root, edit.path), edit.after);
		});
		if (isFailure(applied)) return applied;
		for (let path of remove) ctx.stdout(`Removed ${path}\n`);
		for (let edit of edits) ctx.stdout(`Edited ${edit.path}\n`);
		let formatted =
			edits.length === 0
				? null
				: await formatFiles(
						ctx,
						config.format,
						edits.map((edit) => edit.path),
						root,
					);
		for (let leftover of leftovers) ctx.stdout(leftover);
		if (formatted !== null && isFailure(formatted)) return formatted;
		return success();
	},
});
