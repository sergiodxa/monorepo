/**
 * The `orphans` check: every app-source module is imported by another, or is an entry the layout
 * loads from outside the graph (bootstrap, routes, initializers, migrations, factories). Dead
 * agent leftovers show up as unreferenced files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { projectGraph } from "../architecture/graph.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/** Prefixes that may have no importers inside the project graph. */
const ENTRY_PREFIXES = [
	"bootstrap/",
	"routes/",
	"app/initializers/",
	"database/migrations/",
	"database/factories/",
	"config/",
] as const;

/**
 * Warns on each non-entry module that nothing in the project imports.
 */
export const orphansCheck: Check = {
	name: "orphans",
	async run(context): Promise<CheckResult> {
		let graph = await projectGraph(context.root);
		if (graph.modules.length === 0) return skipped("No app source to find orphans");
		let imported = new Set(graph.edges.map((edge) => edge.to));
		let findings = graph.modules
			.filter((module) => !imported.has(module) && !isEntry(module))
			.sort()
			.map((module) => `${module}: nothing in the project imports it`);
		if (findings.length === 0) {
			return passed("Every non-entry module is imported somewhere");
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 orphaned module"
					: `Found ${findings.length} orphaned modules`,
			findings,
			fix: "Delete the file, or wire it from an initializer, router, job map or another module that needs it",
		};
	},
};

/** Whether `path` is an entry the layout loads without a same-project importer. */
function isEntry(path: string): boolean {
	return ENTRY_PREFIXES.some((prefix) => path.startsWith(prefix));
}
