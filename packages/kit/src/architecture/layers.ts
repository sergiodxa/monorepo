/**
 * The app-layout layers Clean Architecture's dependency rule maps onto: outer kinds may import
 * inner ones, never the reverse, so a model never reaches a controller and a view never pulls a
 * job. Route contracts and handler declarations are data every layer may read.
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

/**
 * Higher rank is more inward; an import may only reach a layer at this rank or higher. Route
 * contracts are innermost, since controllers, views and the router all read them, and views sit
 * between the handlers that render them and the instances they read.
 */
export const LAYER_RANK: Readonly<Record<Layer, number>> = {
	routes: 50,
	models: 40,
	policies: 30,
	services: 30,
	initializers: 30,
	resources: 25,
	http: 20,
	jobs: 20,
	mcp: 20,
	emails: 20,
	commands: 20,
	test: 20,
	bootstrap: 10,
};

/** Display order for architecture diagrams, outer first. */
export const LAYER_ORDER: readonly Layer[] = [
	"bootstrap",
	"http",
	"jobs",
	"mcp",
	"emails",
	"commands",
	"test",
	"resources",
	"initializers",
	"services",
	"policies",
	"models",
	"routes",
];

/**
 * The modules that declare what a runtime offers: jobs, commands, emails, MCP tools and
 * resources. Each holds names and schemas only, so the initializer that maps them and the
 * handlers that enqueue or send through them both read it.
 */
const DECLARATIONS = new Set([
	"app/jobs/index.ts",
	"app/commands/index.ts",
	"app/emails/index.ts",
	"app/mcp/tools/index.ts",
	"app/mcp/resources/index.ts",
]);

/** Where an app's own middleware lives, which the router initializer composes into its chain. */
const MIDDLEWARE = "app/http/middleware/";

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
	let normalized = normalize(path);
	for (let [prefix, layer] of LAYER_PREFIXES) {
		if (normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)) return layer;
	}
	return null;
}

/**
 * Whether an import from `from` to `to` obeys the dependency rule. Unranked endpoints are left
 * alone so config and packages stay free to import, any layer reads a declaration module, and
 * an initializer reads the middleware its router's global chain lists.
 */
export function allowsDependency(from: string, to: string): boolean {
	let source = layerOf(from);
	let target = layerOf(to);
	if (source === null || target === null || isDeclaration(to)) return true;
	if (source === "initializers" && normalize(to).startsWith(MIDDLEWARE)) return true;
	return LAYER_RANK[source] <= LAYER_RANK[target];
}

/** Whether `path` is a module that declares a runtime's jobs, commands, emails or MCP handlers. */
export function isDeclaration(path: string): boolean {
	return DECLARATIONS.has(normalize(path));
}

/** `path` with `/` separators. */
function normalize(path: string): string {
	return path.split("\\").join("/");
}
