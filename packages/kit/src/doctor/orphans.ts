/**
 * The `orphans` check: every app-source module is imported by another module or a test, named
 * by a root config file, or is an entry the layout loads from outside the graph (bootstrap,
 * routes, initializers, declarations). Dead agent leftovers show up as unreferenced files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { projectGraph } from "../architecture/graph.js";
import { isDeclaration } from "../architecture/layers.js";

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
		let imported = new Set([...graph.edges, ...graph.testEdges].map((edge) => edge.to));
		let configured = await rootConfigText(context.root);
		let findings = graph.modules
			.filter((module) => !imported.has(module) && !isEntry(module) && !configured.includes(module))
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

/** A tool's config file at the project root, such as `vite.config.ts`. */
const ROOT_CONFIG = /\.config\.[cm]?[jt]s$/;

/**
 * Whether `path` is an entry the layout loads without a same-project importer, or a declaration
 * module `sdxc make` imports into its initializer with the first handler it maps.
 */
function isEntry(path: string): boolean {
	return ENTRY_PREFIXES.some((prefix) => path.startsWith(prefix)) || isDeclaration(path);
}

/**
 * The text of every tool config at the project root, joined, so a module a config names by
 * path, as `vite.config.ts` names a test stand-in for a runtime module, counts as used.
 */
async function rootConfigText(root: string): Promise<string> {
	let entries = await wrap(() => readdir(root));
	if (isFailure(entries)) return "";
	let texts: string[] = [];
	for (let name of entries.data.filter((entry) => ROOT_CONFIG.test(entry))) {
		let text = await wrap(() => readFile(join(root, name), "utf8"));
		if (!isFailure(text)) texts.push(text.data);
	}
	return texts.join("\n");
}
