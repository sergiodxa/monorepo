/**
 * The app-layout layers Clean Architecture's dependency rule maps onto: outer kinds may import
 * inner ones, never the reverse, so a model never reaches a controller and a view never pulls a
 * job. Ranks are the only rule; same-rank edges stay allowed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One kind of code the dependency rule names. Unranked paths (config, database, packages) sit
 * outside the rule so anyone may import them.
 */
export type Layer =
	| "models"
	| "policies"
	| "services"
	| "initializers"
	| "http"
	| "jobs"
	| "mcp"
	| "emails"
	| "commands"
	| "resources"
	| "routes"
	| "bootstrap"
	| "test";

/** Higher rank is more inward; an import may only reach a layer at this rank or higher. */
export const LAYER_RANK: Readonly<Record<Layer, number>> = {
	models: 40,
	policies: 30,
	services: 30,
	initializers: 30,
	http: 20,
	jobs: 20,
	mcp: 20,
	emails: 20,
	commands: 20,
	test: 20,
	resources: 10,
	routes: 10,
	bootstrap: 10,
};

/** Display order for architecture diagrams, outer first. */
export const LAYER_ORDER: readonly Layer[] = [
	"bootstrap",
	"routes",
	"resources",
	"http",
	"jobs",
	"mcp",
	"emails",
	"commands",
	"test",
	"initializers",
	"services",
	"policies",
	"models",
];

/** Prefixes that assign a path to a layer, most specific first. */
const LAYER_PREFIXES: readonly [string, Layer][] = [
	["app/http/", "http"],
	["app/jobs/", "jobs"],
	["app/mcp/", "mcp"],
	["app/emails/", "emails"],
	["app/commands/", "commands"],
	["app/initializers/", "initializers"],
	["app/services/", "services"],
	["app/policies/", "policies"],
	["app/models/", "models"],
	["app/test/", "test"],
	["resources/", "resources"],
	["routes/", "routes"],
	["bootstrap/", "bootstrap"],
];

/**
 * The layer `path` belongs to, or `null` when the path is outside the ranked kinds (config,
 * database, or a package).
 *
 * @param path - Project-relative path with `/` separators.
 */
export function layerOf(path: string): Layer | null {
	let normalized = path.split("\\").join("/");
	for (let [prefix, layer] of LAYER_PREFIXES) {
		if (normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)) return layer;
	}
	return null;
}

/**
 * Whether an import from `from` to `to` obeys the dependency rule. Unranked endpoints are left
 * alone so config and packages stay free to import.
 */
export function allowsDependency(from: string, to: string): boolean {
	let source = layerOf(from);
	let target = layerOf(to);
	if (source === null || target === null) return true;
	return LAYER_RANK[source] <= LAYER_RANK[target];
}
