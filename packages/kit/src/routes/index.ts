/**
 * Lists every route of a project as `sdxc routes` prints it: each route contract in `routes/`
 * evaluated to full patterns, joined with what the router initializers in `app/initializers/`
 * map onto it. Reads source only, so it runs without bindings, a build or an install.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import type { MapValue, Module, RouteValue, Value } from "./modules.js";
import type { ControllerRef, MiddlewareEntry, Router } from "./routers.js";

import { Project } from "./modules.js";
import { readRouters } from "./routers.js";

export type { ControllerRef, MiddlewareEntry, Router } from "./routers.js";

/** One route, and what runs for it; the shape `sdxc routes --json` prints. */
export interface RouteEntry {
	/** `GET`, `POST`, …, or `ANY` for a bare pattern. */
	method: string;
	pattern: string;
	/** The route contract it is declared in; a contract composed into another reports the outer one. */
	contract: string;
	/** Its key path in the contract, `posts.show`. */
	name: string;
	/** The initializer that maps it, or `null` when no router does. */
	router: string | null;
	/** `null` when no router maps it; its `file` is `null` when the mapping cannot be followed. */
	controller: ControllerRef | null;
	middleware: {
		/** The router's global middleware, which runs first. */
		router: MiddlewareEntry[];
		/** `lazy()`'s second argument, which answers before the controller loads. */
		guards: MiddlewareEntry[];
		/** The controller's middleware, then the action's own. */
		controller: MiddlewareEntry[];
	};
}

/** Everything `sdxc routes` prints. */
export interface RouteListing {
	routes: RouteEntry[];
	/** Every router found, for printing each one's global middleware once. */
	routers: RouterSummary[];
	/** Problems the reader met, each naming its file. */
	diagnostics: string[];
}

/** A router as the listing reports it. */
export interface RouterSummary extends Pick<Router, "file" | "middleware"> {
	/**
	 * Each `map()` whose handler loads with the router, as its target and handler, or as its target
	 * and the action key path when only that action does, since that code loads on every request.
	 */
	eager: string[];
}

/** Where a route is declared. */
interface Identity {
	contract: string;
	name: string;
}

/** One mapping of one route, by the route it reaches. */
interface RouteMapping {
	router: Router;
	handler: Router["mappings"][number]["handler"];
	path: string[];
}

/** Lists the routes of the project at `root`. */
export async function listRoutes(root: string): Promise<RouteListing> {
	let project = new Project(root);
	let contracts = await readContracts(project);
	let identities = new Map<RouteValue, Identity>();
	for (let contract of contracts) {
		for (let [route, path] of leaves(contract.value, [])) {
			if (!identities.has(route))
				identities.set(route, { contract: contract.path, name: path.join(".") });
		}
	}

	let routers: Router[] = [];
	for (let file of await sourceFiles(project.root, "app/initializers")) {
		let module = await project.load(file);
		if (module !== null) routers.push(...(await readRouters(project, module)));
	}
	let mapped = new Map<RouteValue, RouteMapping[]>();
	let order: string[] = [];
	for (let router of routers) {
		for (let mapping of router.mappings) {
			let reached = leaves(mapping.target, []);
			if (reached.length === 0) {
				project.diagnostics.push(
					`${router.file}: ${mapping.text} is not a route sdxc routes can read`,
				);
			}
			for (let [route, path] of reached) {
				let list = mapped.get(route) ?? [];
				list.push({ router, handler: mapping.handler, path });
				mapped.set(route, list);
				let contract = identities.get(route)?.contract;
				if (contract !== undefined && !order.includes(contract)) order.push(contract);
			}
		}
	}

	let roots = contracts.filter((contract) => contract.root);
	let listed = [
		...order.flatMap((path) => contracts.filter((contract) => contract.path === path)),
		...roots.filter((contract) => !order.includes(contract.path)),
	];
	let routes: RouteEntry[] = [];
	for (let contract of listed) {
		for (let [route] of leaves(contract.value, [])) {
			let identity = identities.get(route);
			if (identity === undefined || identity.contract !== contract.path) continue;
			let mappings = mapped.get(route) ?? [];
			if (mappings.length === 0 && !contract.root) continue;
			let base = { method: route.method, pattern: route.pattern, ...identity };
			if (mappings.length === 0) {
				routes.push({
					...base,
					router: null,
					controller: null,
					middleware: { router: [], guards: [], controller: [] },
				});
				continue;
			}
			for (let mapping of mappings) {
				let handler = await mapping.handler.forAction(mapping.path);
				if (handler.controller.file === null) {
					project.diagnostics.push(
						`${mapping.router.file}: ${mapping.handler.text} for ${identity.name} could not be followed to a controller`,
					);
				}
				routes.push({
					...base,
					router: mapping.router.file,
					controller: handler.controller,
					middleware: {
						router: mapping.router.middleware,
						guards: handler.guards,
						controller: handler.middleware,
					},
				});
			}
		}
	}
	return {
		routes,
		routers: routers.map((router) => ({
			file: router.file,
			middleware: router.middleware,
			eager: router.mappings.flatMap((mapping) =>
				mapping.handler.eager.map((path) =>
					path.length === 0
						? `${mapping.text}, ${mapping.handler.text}`
						: `${mapping.text} action ${path.join(".")}`,
				),
			),
		})),
		diagnostics: [...new Set(project.diagnostics)],
	};
}

/**
 * The sources under `app/http/controllers/` that no module in `app/` or `bootstrap/` imports
 * statically. A helper shared by controllers, or a handler the router takes as an option, is
 * imported that way, so what is left is reached by a route's `lazy()` import or by nothing.
 */
export async function unimportedControllers(root: string): Promise<string[]> {
	let project = new Project(root);
	let imported = new Set<string>();
	let sources = [...(await sourceFiles(root, "app")), ...(await sourceFiles(root, "bootstrap"))];
	for (let file of sources) {
		let module = await project.load(file);
		if (module === null) continue;
		for (let specifier of module.specifiers) {
			let target = await project.resolve(file, specifier);
			if (target !== null && target !== file) imported.add(target);
		}
	}
	let controllers = await sourceFiles(root, "app/http/controllers");
	return controllers.filter((file) => !imported.has(file));
}

/** A route contract: a module in `routes/` whose default export is a route map. */
interface Contract {
	path: string;
	value: MapValue;
	/** Whether no other contract imports it, so its routes are listed under its own name. */
	root: boolean;
}

/** Every route contract in `routes/`, in path order. */
async function readContracts(project: Project): Promise<Contract[]> {
	let found: Array<{ module: Module; value: MapValue }> = [];
	for (let file of await sourceFiles(project.root, "routes")) {
		let module = await project.load(file);
		if (module === null || module.declarations.defaultExport === null) continue;
		let value = await project.exportValue(module, "default");
		if (value.kind === "map") found.push({ module, value });
	}
	let imported = new Set<string>();
	for (let { module } of found) {
		for (let specifier of module.specifiers) {
			let file = await project.resolve(module.path, specifier);
			if (file !== null && file !== module.path) imported.add(file);
		}
	}
	return found.map(({ module, value }) => ({
		path: module.path,
		value,
		root: !imported.has(module.path),
	}));
}

/** Every route under `value` with its key path, in declaration order. */
function leaves(value: Value, path: string[]): Array<[RouteValue, string[]]> {
	if (value.kind === "route") return [[value, path]];
	if (value.kind !== "map") return [];
	return [...value.entries].flatMap(([key, entry]) => leaves(entry, [...path, key]));
}

/** The TypeScript and JavaScript sources under a project folder, tests left out, sorted. */
async function sourceFiles(root: string, folder: string): Promise<string[]> {
	let entries = await wrap(() => readdir(join(root, folder), { recursive: true }));
	if (isFailure(entries)) return [];
	return entries.data
		.map((entry) => `${folder}/${entry.split("\\").join("/")}`)
		.filter(
			(path) =>
				/\.[cm]?[jt]sx?$/.test(path) && !/\.test\.[jt]sx?$/.test(path) && !path.endsWith(".d.ts"),
		)
		.sort();
}
