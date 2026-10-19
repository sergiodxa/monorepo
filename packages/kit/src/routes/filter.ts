/**
 * Narrows a route listing to what `sdxc routes` was asked about: a search across names, patterns,
 * methods and controllers, one controller, one method, one contract, or the routes no router maps.
 * Filters compose, and they run before any output, so the table and `--json` agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess, wrap } from "@sdxc/result";

import type { RouteEntry, RouteListing } from "./index.js";

/** The folder a controller lives in, which `--controller` lets a reader leave out. */
const CONTROLLERS_FOLDER = "app/http/controllers/";

/** What to keep; a route stays when it passes every filter given. */
export interface RouteFilters {
	/**
	 * Matched, ignoring case, against the name, pattern, method and `file#export` of the
	 * controller, as plain text or as a regular expression, so `/posts/:id` and `^posts\.` both work.
	 */
	grep?: string;
	/** A controller file, with or without `app/http/controllers/` and its extension; a folder keeps every controller in it. */
	controller?: string;
	/** `GET`, `post`, …; a route declared for `ANY` method answers every one, so it stays. */
	method?: string;
	/** A contract in `routes/`, as `web`, `routes/web` or `routes/web.ts`. */
	contract?: string;
	/** Keeps the routes a contract declares and no router maps. */
	unused?: boolean;
}

/** Whether any filter is set, so the command can tell an empty project from an empty result. */
export function hasFilters(filters: RouteFilters): boolean {
	return (
		filters.grep !== undefined ||
		filters.controller !== undefined ||
		filters.method !== undefined ||
		filters.contract !== undefined ||
		filters.unused === true
	);
}

/**
 * The listing with only the routes that pass every filter, and only the routers that map one of
 * them, so a narrowed table carries no global middleware it does not list. Without filters the
 * listing comes back as it is.
 */
export function filterRoutes(listing: RouteListing, filters: RouteFilters): RouteListing {
	if (!hasFilters(filters)) return listing;
	let search = filters.grep === undefined ? null : matcher(filters.grep);
	let routes = listing.routes.filter((route) => matches(route, filters, search));
	let used = new Set(routes.map((route) => route.router));
	return {
		...listing,
		routes,
		routers: listing.routers.filter((router) => used.has(router.file)),
	};
}

/**
 * The controller files among `files` no route of `listing` loads, narrowed by
 * `--grep` and `--controller`, which both read the file. A `--method` or `--contract` filter
 * leaves none, since a file no route maps has neither.
 *
 * @param files - The controller sources no module imports statically, project-relative
 * @param listing - The listing before any filter, so a route filtered out still counts as a use
 */
export function unmappedControllers(
	files: readonly string[],
	listing: RouteListing,
	filters: RouteFilters,
): string[] {
	if (filters.method !== undefined || filters.contract !== undefined) return [];
	let mapped = new Set(listing.routes.map((route) => route.controller?.file));
	let search = filters.grep === undefined ? null : matcher(filters.grep);
	return files.filter(
		(file) =>
			!mapped.has(file) &&
			(search === null || search(file)) &&
			(filters.controller === undefined || controllerMatches(file, filters.controller)),
	);
}

/** Whether `route` passes every filter in `filters`, with `--grep` compiled once as `search`. */
function matches(
	route: RouteEntry,
	filters: RouteFilters,
	search: ((value: string) => boolean) | null,
): boolean {
	if (filters.unused === true && route.controller !== null) return false;
	if (filters.method !== undefined) {
		let method = filters.method.toUpperCase();
		if (route.method !== method && route.method !== "ANY") return false;
	}
	if (
		filters.contract !== undefined &&
		contractName(route.contract) !== contractName(filters.contract)
	) {
		return false;
	}
	if (filters.controller !== undefined) {
		let file = route.controller?.file ?? null;
		if (file === null || !controllerMatches(file, filters.controller)) return false;
	}
	if (search !== null) {
		let fields = [route.name, route.pattern, route.method];
		if (route.controller?.file) fields.push(route.controller.file);
		let named = route.controller?.export;
		if (named !== undefined && named !== null && named !== "default") fields.push(named);
		if (!fields.some(search)) return false;
	}
	return true;
}

/**
 * A case-insensitive test for `pattern` as plain text or as a regular expression: a URL pattern
 * whose `(`, `.` or `*` mean something to a regular expression still finds itself, and text that
 * is no valid expression searches as plain text alone.
 */
function matcher(pattern: string): (value: string) => boolean {
	let text = pattern.toLowerCase();
	let compiled = wrap(() => new RegExp(pattern, "i"));
	let expression = isSuccess(compiled) ? compiled.data : null;
	return (value) => value.toLowerCase().includes(text) || (expression?.test(value) ?? false);
}

/** Whether the controller `file` is `wanted` or sits in the folder `wanted` names. */
function controllerMatches(file: string, wanted: string): boolean {
	let name = controllerName(file);
	let target = controllerName(wanted);
	return name === target || name.startsWith(`${target}/`);
}

/** A controller path without `./`, its folder, its extension or a trailing `/index`, lowercased. */
function controllerName(path: string): string {
	let name = path.trim().toLowerCase().replace(/^\.\//, "").replace(/\/+$/, "");
	if (name.startsWith(CONTROLLERS_FOLDER)) name = name.slice(CONTROLLERS_FOLDER.length);
	return name.replace(/\.[cm]?[jt]sx?$/, "").replace(/\/index$/, "");
}

/** A contract path without `./`, `routes/` or its extension, lowercased. */
function contractName(path: string): string {
	return path
		.trim()
		.toLowerCase()
		.replace(/^\.\//, "")
		.replace(/^routes\//, "")
		.replace(/\.[cm]?[jt]sx?$/, "");
}
