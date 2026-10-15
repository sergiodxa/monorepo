/**
 * The `sdxc ui list` handler: one line per component in the installed release and per copy
 * the release no longer ships, marking each copy's release and whether it is edited or behind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { ListRow } from "../../ui/commands.js";

import { SDXC_COMMANDS } from "../../contract.js";
import { packageRoot, project } from "../../middleware.js";
import { listComponents, loadContext } from "../../ui/commands.js";

/** Prints every component, sorted by name. */
export default createCommand(SDXC_COMMANDS.ui.list, {
	middleware: [project(), packageRoot()],
	/** Writes the table to stdout. */
	async handler(ctx) {
		let context = await loadContext(ctx.project, ctx.packageRoot);
		if (isFailure(context)) return context;
		ctx.stdout(formatList(await listComponents(context.data)));
		return success();
	},
});

/**
 * The `list` output: one line per component, its name padded to a column, then whether it is
 * copied, from which release, and whether the copy is edited or behind.
 */
export function formatList(rows: readonly ListRow[]): string {
	let width = Math.max(0, ...rows.map((row) => row.name.length));
	return rows
		.map((row) => {
			if (row.copy === null) return `${row.name}\n`;
			let state = [`copied from ${row.copy.release}`];
			if (row.copy.edited) state.push("edited");
			if (row.changedIn === null) state.push("no longer shipped");
			else if (row.copy.behind) state.push(`behind, changed in ${row.changedIn}`);
			return `${row.name.padEnd(width)}  ${state.join(", ")}\n`;
		})
		.join("");
}
