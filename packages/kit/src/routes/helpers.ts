/**
 * The `remix/routes` helpers restated over evaluated values: method routes, `route()` with its
 * prefix, `form()`, `resources()` and `resource()` with `only`, `exclude`, `param` and `names`.
 * They follow the rules the helpers apply at runtime, so a listed pattern is the one the router matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MapValue, RouteValue, Value } from "./modules.js";

/** The specifiers the route helpers are imported from. */
const ROUTE_MODULES = new Set([
	"remix/routes",
	"remix/fetch-router",
	"remix/fetch-router/routes",
	"@remix-run/fetch-router",
	"@remix-run/fetch-router/routes",
]);

/** Every exported helper name, shorthand and long form, to its canonical name. */
const HELPERS: Readonly<Record<string, string>> = {
	route: "route",
	createRoutes: "route",
	get: "GET",
	createGetRoute: "GET",
	post: "POST",
	createPostRoute: "POST",
	put: "PUT",
	createPutRoute: "PUT",
	patch: "PATCH",
	createPatchRoute: "PATCH",
	del: "DELETE",
	createDeleteRoute: "DELETE",
	head: "HEAD",
	createHeadRoute: "HEAD",
	options: "OPTIONS",
	createOptionsRoute: "OPTIONS",
	form: "form",
	createFormRoutes: "form",
	resources: "resources",
	createResourcesRoutes: "resources",
	resource: "resource",
	createResourceRoutes: "resource",
};

/** `resources()`'s actions in the order it declares them, with each one's method and pattern. */
const RESOURCES_ACTIONS: ReadonlyArray<readonly [string, string, (param: string) => string]> = [
	["index", "GET", () => "/"],
	["new", "GET", () => "/new"],
	["show", "GET", (param) => `/:${param}`],
	["create", "POST", () => "/"],
	["edit", "GET", (param) => `/:${param}/edit`],
	["update", "PUT", (param) => `/:${param}`],
	["destroy", "DELETE", (param) => `/:${param}`],
];

/** `resource()`'s actions, a singular resource with no index and no param. */
const RESOURCE_ACTIONS: ReadonlyArray<readonly [string, string, (param: string) => string]> = [
	["new", "GET", () => "/new"],
	["show", "GET", () => "/"],
	["create", "POST", () => "/"],
	["edit", "GET", () => "/edit"],
	["update", "PUT", () => "/"],
	["destroy", "DELETE", () => "/"],
];

/** The opaque value. */
const OPAQUE: Value = { kind: "opaque" };

/** The canonical helper an import binds, or `null` when it is not a route helper. */
export function helperName(specifier: string, imported: string): string | null {
	if (!ROUTE_MODULES.has(specifier)) return null;
	return HELPERS[imported] ?? null;
}

/**
 * Applies the helper `name` to evaluated arguments. An argument the reader could not evaluate
 * leaves the result opaque, and `report` names an entry a route map drops.
 */
export function applyHelper(name: string, args: Value[], report: (message: string) => void): Value {
	let [first, second] = args;
	if (name === "route") {
		if (first?.kind === "string" && second?.kind === "map")
			return build(first.value, second, report);
		if (first?.kind === "map") return build("/", first, report);
		return OPAQUE;
	}
	if (first?.kind !== "string") return OPAQUE;
	let options = second?.kind === "map" ? second : null;
	if (name === "form") {
		let names = mapOf(options?.entries.get("names"));
		let method = stringOf(options?.entries.get("formMethod")) ?? "POST";
		let defs = new Map<string, Value>([
			[stringOf(names?.entries.get("index")) ?? "index", route("GET", "/")],
			[stringOf(names?.entries.get("action")) ?? "action", route(method, "/")],
		]);
		return build(first.value, { kind: "map", entries: defs }, report);
	}
	if (name === "resources" || name === "resource") {
		let actions = name === "resources" ? RESOURCES_ACTIONS : RESOURCE_ACTIONS;
		let only = stringsOf(options?.entries.get("only"));
		let exclude = stringsOf(options?.entries.get("exclude"));
		let param = stringOf(options?.entries.get("param")) ?? "id";
		let names = mapOf(options?.entries.get("names"));
		let defs = new Map<string, Value>();
		for (let [action, method, pattern] of actions) {
			if (only !== null && !only.includes(action)) continue;
			if (only === null && exclude !== null && exclude.includes(action)) continue;
			defs.set(stringOf(names?.entries.get(action)) ?? action, route(method, pattern(param)));
		}
		return build(first.value, { kind: "map", entries: defs }, report);
	}
	return route(name, first.value);
}

/**
 * Joins two patterns as a route prefix does: `/` on either side leaves the other, and otherwise
 * exactly one slash separates them.
 */
export function joinPatterns(base: string, pattern: string): string {
	if (pattern === "" || pattern === "/") return base === "" ? "/" : base;
	if (base === "" || base === "/") return pattern.startsWith("/") ? pattern : `/${pattern}`;
	return `${base.replace(/\/+$/, "")}/${pattern.replace(/^\/+/, "")}`;
}

/**
 * A route map with `base` joined onto every route under `defs`, each a new route object. A bare
 * string is an `ANY` route and `{ method, pattern }` a route, as `route()` reads them.
 */
function build(base: string, defs: MapValue, report: (message: string) => void): MapValue {
	let entries = new Map<string, Value>();
	for (let [key, def] of defs.entries) {
		if (def.kind === "route") entries.set(key, route(def.method, joinPatterns(base, def.pattern)));
		else if (def.kind === "string") entries.set(key, route("ANY", joinPatterns(base, def.value)));
		else if (def.kind === "map") {
			let pattern = stringOf(def.entries.get("pattern"));
			if (pattern !== null) {
				let method = stringOf(def.entries.get("method")) ?? "ANY";
				entries.set(key, route(method, joinPatterns(base, pattern)));
			} else entries.set(key, build(base, def, report));
		} else report(`\`${key}\` is declared with code sdxc routes does not evaluate; it is left out`);
	}
	return { kind: "map", entries };
}

/** A new route object, so each declaration has its own identity. */
function route(method: string, pattern: string): RouteValue {
	return { kind: "route", method, pattern };
}

/** The string a value holds, or `null` when it holds anything else. */
function stringOf(value: Value | undefined): string | null {
	return value?.kind === "string" ? value.value : null;
}

/** The map a value holds, or `null` when it holds anything else. */
function mapOf(value: Value | undefined): MapValue | null {
	return value?.kind === "map" ? value : null;
}

/** The strings of an array value, or `null` when it is not an array of strings. */
function stringsOf(value: Value | undefined): string[] | null {
	if (value?.kind !== "array") return null;
	return value.items.flatMap((item) => (item.kind === "string" ? [item.value] : []));
}
