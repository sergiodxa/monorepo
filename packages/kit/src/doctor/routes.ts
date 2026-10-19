/**
 * The `routes` check: every route a contract declares is mapped by a router, through `lazy()`.
 * An unmapped route answers 404 while its links type check, and a controller mapped without
 * `lazy()` loads with the router, so every request imports it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { listRoutes } from "../routes/index.js";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/** Warns on each declared route no router maps, and on each mapping written without `lazy()`. */
export const routesCheck: Check = {
	name: "routes",
	async run(context): Promise<CheckResult> {
		let folder = await wrap(() => stat(join(context.root, "routes")));
		if (isFailure(folder) || !folder.data.isDirectory()) {
			return skipped("No routes/ folder in the project");
		}
		let listing = await listRoutes(context.root);
		let unmapped = listing.routes
			.filter((route) => route.router === null)
			.map(
				(route) =>
					`${route.method} ${route.pattern} (${route.contract} ${route.name}) is mapped by no router`,
			);
		let eager = listing.routers.flatMap((router) =>
			router.eager.map((mapping) => `${router.file} maps ${mapping} without lazy()`),
		);
		if (unmapped.length === 0 && eager.length === 0) {
			return passed(`${listing.routes.length} routes are mapped through lazy()`);
		}
		let problems = [
			unmapped.length === 0
				? null
				: plural(unmapped.length, "route no router maps", "routes no router maps"),
			eager.length === 0
				? null
				: plural(eager.length, "mapping without lazy()", "mappings without lazy()"),
		].filter((problem) => problem !== null);
		return {
			status: "warn",
			message: `Found ${problems.join(" and ")}`,
			findings: [...unmapped, ...eager],
			fix: "Map each route in its router initializer as router.map(route, lazy(() => import(…))); sdxc make controller writes and maps one",
		};
	},
};

/** `count` with the singular or plural noun phrase it takes. */
function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}
