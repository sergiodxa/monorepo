/**
 * `sdxc make controller <name> --actions`: one controller per action of a resource, each
 * declared under `<name>` with the method and route a resource's pages or JSON endpoints take,
 * and, with `--resource`, guarded by the ability the action needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Project } from "../middleware.js";

import { formatFiles } from "../format.js";

import type { ResourceAction } from "./guard.js";

import { exists } from "./generate.js";
import { parseName } from "./names.js";

import type { MakeContext, MakeInput } from "./index.js";

import { makeUnformatted } from "./index.js";

/** One action's controller: the method its route answers, its pattern and its ability. */
interface ActionRoute {
	method: string;
	/** The pattern after `/<name>`. */
	suffix: string;
	/** The ability a guarded controller checks; a list checks each row it shows instead. */
	ability: ResourceAction | null;
}

/** The pages of a resource, as `sdxc scaffold` routes them. */
const PAGE_ACTIONS: Readonly<Record<string, ActionRoute>> = {
	index: { method: "get", suffix: "", ability: null },
	new: { method: "form", suffix: "/new", ability: "create" },
	show: { method: "get", suffix: "/:id", ability: "read" },
	edit: { method: "form", suffix: "/:id/edit", ability: "update" },
	destroy: { method: "post", suffix: "/:id/destroy", ability: "delete" },
};

/** The JSON endpoints of a resource, one per method. */
const API_ACTIONS: Readonly<Record<string, ActionRoute>> = {
	index: { method: "get", suffix: "", ability: null },
	show: { method: "get", suffix: "/:id", ability: "read" },
	create: { method: "post", suffix: "", ability: "create" },
	update: { method: "patch", suffix: "/:id", ability: "update" },
	destroy: { method: "delete", suffix: "/:id", ability: "delete" },
};

/** The contract whose controllers answer JSON, so its actions are the endpoints. */
const API_CONTRACT = "api";

/** What `--actions` was given beside the controller's own flags. */
export interface ActionsInput extends Omit<MakeInput, "kind" | "method" | "path" | "ability"> {
	actions: readonly string[];
}

/**
 * Makes one controller per action in `input.actions` under `input.name`, in the order the
 * contract lists them. Every action's file is checked free before the first is written, so a
 * taken name stops the run with nothing written.
 *
 * @param packageRoot - The `@sdxc/kit` package, whose `stubs/` holds the built-in stubs.
 */
export async function makeActions(
	ctx: MakeContext,
	project: Project,
	packageRoot: string,
	input: ActionsInput,
): Promise<Result<void, Error>> {
	let routes = input.routes ?? project.config.make.routes;
	let table = routes === API_CONTRACT ? API_ACTIONS : PAGE_ACTIONS;
	let wanted = input.actions.includes("all") ? Object.keys(table) : [...new Set(input.actions)];
	let unknown = wanted.filter((action) => !(action in table));
	if (unknown.length > 0) {
		let contract = routes === API_CONTRACT ? "the api contract" : `routes/${routes}`;
		return failure(
			new Error(
				`${unknown.join(", ")} ${unknown.length === 1 ? "is not an action" : "are not actions"} of ${contract}; use ${Object.keys(table).join(", ")} or all`,
			),
		);
	}
	let base = parseName(input.name);
	if (isFailure(base)) return base;
	let folder = base.data.segments.join("/");
	let ordered = Object.keys(table).filter((action) => wanted.includes(action));
	for (let action of ordered) {
		let path = `app/http/controllers/${folder}/${action}.tsx`;
		if (input.force !== true && (await exists(project.root, path))) {
			return failure(
				new Error(`${path} already exists; sdxc make leaves it as it is unless --force`),
			);
		}
	}
	let changed: string[] = [];
	for (let action of ordered) {
		let route = table[action] as ActionRoute;
		let guarded = input.guardedBy !== undefined && route.ability !== null;
		let made = await makeUnformatted(ctx, project, packageRoot, {
			...input,
			kind: "controller",
			name: `${folder}/${action}`,
			method: route.method,
			path: `/${folder}${route.suffix}`,
			routes,
			guardedBy: guarded ? input.guardedBy : undefined,
			ability: guarded ? (route.ability ?? undefined) : undefined,
		});
		if (isFailure(made)) return made;
		changed.push(...made.data.filter((path) => !changed.includes(path)));
	}
	if (input.guardedBy !== undefined && ordered.includes("index")) {
		ctx.stdout(
			`${folder}/index lists rows, so it checks no single one; show each row a visitor may read with ctx.access.can(abilities.<resource>.read, { <resource>: row })\n`,
		);
	}
	if (changed.length === 0) return success(undefined);
	return formatFiles(ctx, project.config.format, changed, project.root);
}
