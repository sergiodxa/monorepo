/**
 * The `sdxc routes` handler: prints every route of the project, its controller and the
 * middleware that runs for it, as a table, one block per route, or JSON an agent parses,
 * narrowed by its filters first. Diagnostics go to stderr, so stdout holds the listing alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import type { RouteFilters } from "../routes/filter.js";

import { SDXC_COMMANDS } from "../contract.js";
import { project } from "../middleware.js";
import { filterRoutes, hasFilters, unmappedControllers } from "../routes/filter.js";
import { formatExpanded, formatJSON, formatTable } from "../routes/format.js";
import { listRoutes, unimportedControllers } from "../routes/index.js";

/** Reads the project's contracts and routers and prints what they declare and map. */
export default createCommand(SDXC_COMMANDS.routes, {
	middleware: [project()],
	/**
	 * Always succeeds once the project is found: a route it cannot read is a diagnostic, and a
	 * filter that matches nothing prints an empty result. With `--unused`, each controller file
	 * no route maps is reported on stderr too, so `--json` stays an array of routes.
	 */
	async handler(ctx) {
		let listing = await listRoutes(ctx.project.root);
		let filters: RouteFilters = {
			grep: ctx.flags.grep,
			controller: ctx.flags.controller,
			method: ctx.flags.method,
			contract: ctx.flags.contract,
			unused: ctx.flags.unused,
		};
		let filtered = filterRoutes(listing, filters);
		if (ctx.flags.json) ctx.stdout(formatJSON(filtered));
		else if (filtered.routes.length === 0 && hasFilters(filters)) {
			ctx.stdout(filters.unused ? "No unused routes found.\n" : "No routes match.\n");
		} else ctx.stdout(ctx.flags.expanded ? formatExpanded(filtered) : formatTable(filtered));
		for (let diagnostic of listing.diagnostics) ctx.stderr(`${diagnostic}\n`);
		if (filters.unused) {
			let files = unmappedControllers(
				await unimportedControllers(ctx.project.root),
				listing,
				filters,
			);
			for (let file of files) ctx.stderr(`${file}: no route maps this controller\n`);
		}
		return success();
	},
});
