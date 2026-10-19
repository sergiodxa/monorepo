/**
 * The `sdxc notes` handler: lists every note comment in the project's layout folders, grouped
 * by file, or as JSON for an agent, with `--tag` choosing the tags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../contract.js";
import { project } from "../middleware.js";
import { DEFAULT_TAGS, formatNotes, projectNotes } from "../notes.js";

/** Reads the project's code and prints its notes. */
export default createCommand(SDXC_COMMANDS.notes, {
	middleware: [project()],
	/** Always succeeds once the project is found; a project without notes says so. */
	async handler(ctx) {
		let tags =
			ctx.flags.tag.length > 0 ? ctx.flags.tag.map((tag) => tag.toUpperCase()) : DEFAULT_TAGS;
		let notes = await projectNotes(ctx.project.root, tags);
		if (ctx.flags.json) ctx.stdout(`${JSON.stringify(notes, null, 2)}\n`);
		else if (notes.length === 0) ctx.stdout(`No ${tags.join(", ")} notes found.\n`);
		else ctx.stdout(formatNotes(notes));
		return success();
	},
});
