/**
 * `sdxc middleware`: every chain a request can run, in the order it runs it. Each router's global
 * middleware comes first, then every module in `app/http/middleware/`: a chain such as `page`
 * expanded to its members, or a single middleware, each with the number of routes that run it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isAppSource, listFiles } from "../doctor/files.js";

import type { Node } from "./parse.js";
import type { MiddlewareEntry } from "./routers.js";

import { Project } from "./modules.js";
import { middlewareList } from "./routers.js";

import { listRoutes } from "./index.js";

/** The folder the app's middleware lives in. */
const MIDDLEWARE_FOLDER = "app/http/middleware";

/** One module in the middleware folder. */
export interface MiddlewareModule {
	file: string;
	/**
	 * `chain` for a module whose default export is `createMiddleware(…)`, whose `middleware`
	 * lists what it runs in order; `middleware` for one that is a middleware itself.
	 */
	kind: "chain" | "middleware";
	middleware: MiddlewareEntry[];
	/** The routes whose router, guards or controller run it, directly or through a chain. */
	routes: number;
}

/** What `sdxc middleware` prints. */
export interface MiddlewareListing {
	/** Each router's global middleware, which runs before anything else. */
	routers: Array<{ file: string; middleware: MiddlewareEntry[] }>;
	modules: MiddlewareModule[];
}

/** Reads the routers and the middleware folder of the project at `root`. */
export async function listMiddleware(root: string): Promise<MiddlewareListing> {
	let listing = await listRoutes(root);
	let project = new Project(root);
	let modules: MiddlewareModule[] = [];
	for (let file of (await listFiles(root, MIDDLEWARE_FOLDER)).filter(isAppSource)) {
		let members = await chainMembers(project, file);
		modules.push({
			file,
			kind: members === null ? "middleware" : "chain",
			middleware: members ?? [],
			routes: 0,
		});
	}
	for (let module of modules) {
		let chains = modules
			.filter((chain) => chain.middleware.some((entry) => entry.from === module.file))
			.map((chain) => chain.file);
		let runs = new Set([module.file, ...chains]);
		module.routes = listing.routes.filter((route) =>
			[...route.middleware.router, ...route.middleware.guards, ...route.middleware.controller].some(
				(entry) => entry.from !== null && runs.has(entry.from),
			),
		).length;
	}
	return {
		routers: listing.routers.map((router) => ({
			file: router.file,
			middleware: router.middleware,
		})),
		modules,
	};
}

/**
 * The members of the chain `file` default-exports as `createMiddleware(a, b, …)`, each array
 * argument expanded, or `null` when its default export is something else.
 */
async function chainMembers(project: Project, file: string): Promise<MiddlewareEntry[] | null> {
	let module = await project.load(file);
	if (module === null) return null;
	let found = await project.exported(module, "default");
	if (found === null) return null;
	let node: Node = found.node;
	if (node.kind === "identifier") {
		let binding = await project.bind(found.module, node.name);
		if (binding.kind !== "local") return null;
		node = binding.node;
	}
	if (node.kind !== "call" || node.callee.kind !== "identifier") return null;
	let imported = found.module.imports.get(node.callee.name);
	if (imported?.imported !== "createMiddleware") return null;
	let members: MiddlewareEntry[] = [];
	for (let argument of node.args) {
		members.push(...(await middlewareList(project, found.module, argument.node)));
	}
	return members;
}

/** The listing as text: each router's chain, then each module, members numbered in run order. */
export function formatMiddleware(listing: MiddlewareListing): string {
	let block = (title: string, entries: readonly MiddlewareEntry[]) => {
		let width = Math.max(0, ...entries.map((entry) => entry.name.length));
		let digits = String(entries.length).length;
		let lines = entries.map((entry, index) => {
			let from = entry.from === null ? "" : `  ${entry.from}`;
			let number = `${index + 1}.`.padStart(digits + 1);
			return `  ${number} ${entry.name.padEnd(width)}${from}`.trimEnd();
		});
		return [title, ...lines].join("\n");
	};
	let blocks = [
		...listing.routers.map((router) =>
			block(`${router.file}, the router's global middleware:`, router.middleware),
		),
		...listing.modules.map((module) => {
			let used = `${module.routes} route${module.routes === 1 ? "" : "s"}`;
			return module.kind === "chain"
				? block(`${module.file}, a chain ${used} run:`, module.middleware)
				: `${module.file}, a middleware ${used} run`;
		}),
	];
	return blocks.length === 0 ? "No routers or middleware found.\n" : `${blocks.join("\n\n")}\n`;
}
