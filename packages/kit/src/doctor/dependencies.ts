/**
 * The `dependencies` check: import cycles and Clean Architecture breaches against the app-layout
 * layers — models stay inward of services and http, resources stay outward of delivery code.
 * Oxlint has no project-wide dependency-rule or cycle check for this layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { projectGraph } from "../architecture/graph.js";
import { layerOf } from "../architecture/layers.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/**
 * Warns on each import cycle and each edge that points from an inner layer to an outer one.
 */
export const dependenciesCheck: Check = {
	name: "dependencies",
	async run(context): Promise<CheckResult> {
		let graph = await projectGraph(context.root);
		if (graph.modules.length === 0) return skipped("No app source to check dependencies");
		let findings: string[] = [];
		for (let cycle of graph.cycles) {
			findings.push(`cycle: ${cycle.join(" -> ")} -> ${cycle[0]}`);
		}
		for (let edge of graph.violations) {
			let from = layerOf(edge.from) ?? "?";
			let to = layerOf(edge.to) ?? "?";
			findings.push(
				`${edge.from} (${from}) imports ${edge.to} (${to}); dependencies must point inward`,
			);
		}
		if (findings.length === 0) {
			return passed("No import cycles; every layer edge points inward");
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 dependency structure problem"
					: `Found ${findings.length} dependency structure problems`,
			findings,
			fix: "Break each cycle with an interface or extract shared code inward; move imports so outer layers depend on inner ones (models innermost). sdxc diagram shows the graph",
		};
	},
};
