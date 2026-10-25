/**
 * The `fan-out` check: no module statically imports more distinct project modules than
 * `doctor.fanOut.max` (default 15), so one file cannot become a hub that couples half the app.
 * A `lazy()` mapping is a deferred import, so a router grows with its routes freely.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { projectGraph } from "../architecture/graph.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/**
 * Warns on each module whose distinct static import targets exceed the configured maximum.
 */
export const fanOutCheck: Check = {
	name: "fan-out",
	async run(context): Promise<CheckResult> {
		let max = context.config.doctor.fanOut.max;
		let graph = await projectGraph(context.root);
		if (graph.modules.length === 0) return skipped("No app source to measure fan-out");
		let counts = new Map<string, Set<string>>();
		for (let edge of graph.edges.filter((candidate) => !candidate.deferred)) {
			let set = counts.get(edge.from) ?? new Set();
			set.add(edge.to);
			counts.set(edge.from, set);
		}
		let findings = [...counts.entries()]
			.filter(([, targets]) => targets.size > max)
			.sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
			.map(([file, targets]) => `${file}: imports ${targets.size} modules (max ${max})`);
		if (findings.length === 0) {
			return passed(`Every module imports at most ${max} others`);
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 module above the fan-out limit"
					: `Found ${findings.length} modules above the fan-out limit`,
			findings,
			fix: `Split the module or extract a narrower facade, or raise doctor.fanOut.max in .config/sdxc.jsonc`,
		};
	},
};
