/**
 * Reads a router initializer: the global middleware of each `createRouter()`, and every
 * `router.map(target, handler)` with the controller its handler loads, the guards `lazy()`
 * runs first and the middleware the controller declares for each action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Module, Project, Value } from "./modules.js";
import type { CallNode, FunctionNode, Node, ObjectNode } from "./parse.js";

/** One middleware as written, and where it comes from. */
export interface MiddlewareEntry {
	/** The expression as written, a long call shortened to `callee(…)`. */
	name: string;
	/**
	 * The project file (`app/http/middleware/page.ts`) or package (`@sdxc/logger/middleware`) the
	 * expression's name is imported from; `null` when the same file declares it.
	 */
	from: string | null;
}

/** The module a mapping loads and the export it serves. */
export interface ControllerRef {
	/** Project-relative; `null` when the mapping could not be followed to a file. */
	file: string | null;
	/** `default`, a named export, or `null` for an inline controller or an unknown export. */
	export: string | null;
}

/** What one mapping runs for one action. */
export interface Handler {
	controller: ControllerRef;
	guards: MiddlewareEntry[];
	/** The controller's own middleware for this action, its chain first. */
	middleware: MiddlewareEntry[];
}

/** A router's handler for a mapping, resolved per action key path. */
export interface MappedHandler {
	/** The handler for the route reached by `path` inside the mapped target. */
	forAction(path: readonly string[]): Promise<Handler>;
	/** The handler expression, for diagnostics. */
	text: string;
	/**
	 * Each part that loads its controller with the router, as the action key path reaching it
	 * (`[]` for the whole handler). Parts behind `lazy()` or a dynamic `import()` load only when a
	 * request reaches them, and a handler that could not be followed reports none.
	 */
	eager: string[][];
}

/** One `router.map()` call. */
export interface Mapping {
	/** The evaluated target: a route, a route map, or an object of routes. */
	target: Value;
	handler: MappedHandler;
	/** The target expression, for diagnostics. */
	text: string;
}

/** One router a file creates. */
export interface Router {
	/** The initializer, project-relative. */
	file: string;
	middleware: MiddlewareEntry[];
	mappings: Mapping[];
}

/** The longest middleware expression shown whole; longer calls show as `callee(…)`. */
const NAME_LIMIT = 40;

/**
 * A dynamic `import()` in an inline handler's source, which defers the module it loads to the
 * first request the way `lazy()` does.
 */
const DYNAMIC_IMPORT = /\bimport\s*\(/;

/** The specifiers `createRouter` is imported from. */
const ROUTER_MODULES = new Set(["remix/router", "remix/fetch-router", "@remix-run/fetch-router"]);

/** A controller's chain, and the chains of its actions by key. */
interface ControllerChain {
	middleware: MiddlewareEntry[];
	actions: Map<string, ControllerChain>;
}

/** The routers `module` creates, in source order. */
export async function readRouters(project: Project, module: Module): Promise<Router[]> {
	let factories = [...module.imports]
		.filter(
			([, imported]) =>
				imported.imported === "createRouter" && ROUTER_MODULES.has(imported.specifier),
		)
		.map(([local]) => local);
	if (factories.length === 0) return [];
	let reader = module.reader;
	let routers: Router[] = [];
	for (let index = 0; index < reader.tokens.length; index += 1) {
		let token = reader.tokens[index];
		if (token?.type !== "identifier" || !factories.includes(token.value)) continue;
		if (reader.is(index - 1, ".") || reader.isWord(index - 1, "import")) continue;
		let call = reader.expression(index, reader.tokens.length).node;
		if (call.kind !== "call") continue;
		let instance = instanceName(module, index);
		let options = call.args[0]?.node;
		let middleware = options?.kind === "object" ? property(options, "middleware") : undefined;
		routers.push({
			file: module.path,
			middleware: middleware === undefined ? [] : await middlewareList(project, module, middleware),
			mappings: instance === null ? [] : await readMappings(project, module, instance),
		});
		if (instance === null) {
			project.diagnostics.push(
				`${module.path}: the router createRouter() builds is not assigned to a name`,
			);
		}
	}
	return routers;
}

/** The name the `createRouter` call at `index` is assigned to: `let router = createRouter(…)`. */
function instanceName(module: Module, index: number): string | null {
	let reader = module.reader;
	if (!reader.is(index - 1, "=")) return null;
	for (let back = index - 2; back >= Math.max(0, index - 30); back -= 1) {
		if (["const", "let", "var"].some((word) => reader.isWord(back, word))) {
			let name = reader.tokens[back + 1];
			return name?.type === "identifier" ? name.value : null;
		}
	}
	return null;
}

/** Every `<instance>.map(target, handler)` call in `module`. */
async function readMappings(
	project: Project,
	module: Module,
	instance: string,
): Promise<Mapping[]> {
	let reader = module.reader;
	let mappings: Mapping[] = [];
	for (let index = 0; index < reader.tokens.length; index += 1) {
		if (!reader.isWord(index, instance) || reader.is(index - 1, ".")) continue;
		if (
			!reader.is(index + 1, ".") ||
			!reader.isWord(index + 2, "map") ||
			!reader.is(index + 3, "(")
		) {
			continue;
		}
		let call = reader.expression(index, reader.tokens.length).node;
		if (call.kind !== "call") continue;
		let [target, handler] = call.args;
		if (target === undefined || handler === undefined) continue;
		mappings.push({
			target: await project.evaluate(target.node, module),
			handler: await mappedHandler(project, module, handler.node, 0),
			text: reader.text(target.node),
		});
	}
	return mappings;
}

/**
 * Follows a mapping's handler: `lazy(() => import(…))` with its guards, an imported controller,
 * a local helper that returns one, or an inline controller object.
 */
async function mappedHandler(
	project: Project,
	module: Module,
	node: Node,
	depth: number,
): Promise<MappedHandler> {
	let text = module.reader.text(node);
	let unresolved: MappedHandler = {
		text,
		eager: [],
		forAction: async () => ({
			controller: { file: null, export: null },
			guards: [],
			middleware: [],
		}),
	};
	if (depth > 4) return unresolved;
	if (node.kind === "call" && node.callee.kind === "identifier") {
		let binding = await project.bind(module, node.callee.name);
		if (binding.kind === "import" && binding.imported === "lazy") {
			return lazyHandler(project, module, node, text);
		}
		if (
			binding.kind === "local" &&
			binding.node.kind === "function" &&
			binding.node.body !== null
		) {
			let inner = await mappedHandler(project, module, binding.node.body, depth + 1);
			return { ...inner, text };
		}
		return unresolved;
	}
	if (node.kind === "identifier") {
		let binding = await project.bind(module, node.name);
		if (binding.kind === "local") {
			let inner = await mappedHandler(project, module, binding.node, depth + 1);
			return { ...inner, text };
		}
		if (binding.kind === "import" && binding.file !== null) {
			let controller = { file: binding.file, export: binding.imported };
			let chain = await controllerChain(project, controller);
			return {
				text,
				eager: [[]],
				forAction: async (path) => ({ controller, guards: [], middleware: chainFor(chain, path) }),
			};
		}
		return unresolved;
	}
	if (node.kind === "object") {
		let chain = await inlineChain(project, module, node);
		let actions = property(node, "actions");
		let ownHandler = property(node, "handler");
		let actionHandlers = new Map<string, MappedHandler>();
		let eager: string[][] = [];
		if (actions?.kind === "object") {
			for (let entry of actions.entries) {
				if ("spread" in entry) continue;
				let action = await mappedHandler(project, module, entry.value, depth + 1);
				eager.push(...action.eager.map((path) => [entry.key, ...path]));
				if (entry.value.kind !== "object") actionHandlers.set(entry.key, action);
			}
		} else if (ownHandler !== undefined) {
			eager = (await mappedHandler(project, module, ownHandler, depth + 1)).eager;
		} else {
			eager = [[]];
		}
		let inline: ControllerRef = { file: module.path, export: null };
		return {
			text,
			eager,
			forAction: async (path) => {
				let action = path[0] === undefined ? undefined : actionHandlers.get(path[0]);
				if (action !== undefined) {
					let handler = await action.forAction(path.slice(1));
					return { ...handler, middleware: [...chain.middleware, ...handler.middleware] };
				}
				return { controller: inline, guards: [], middleware: chainFor(chain, path) };
			},
		};
	}
	if (node.kind === "function") {
		let inline: ControllerRef = { file: module.path, export: null };
		return {
			text,
			eager: DYNAMIC_IMPORT.test(text) ? [] : [[]],
			forAction: async () => ({ controller: inline, guards: [], middleware: [] }),
		};
	}
	return unresolved;
}

/** A `lazy(load, guards?)` mapping: the module `load` imports, the export it picks, the guards. */
async function lazyHandler(
	project: Project,
	module: Module,
	call: CallNode,
	text: string,
): Promise<MappedHandler> {
	let [load, guards] = call.args;
	let loaded =
		load?.node.kind === "function" ? await loadedModule(project, module, load.node) : null;
	let controller: ControllerRef = loaded ?? { file: null, export: null };
	let guardList = guards === undefined ? [] : await middlewareList(project, module, guards.node);
	let chain = controller.file === null ? null : await controllerChain(project, controller);
	return {
		text,
		eager: [],
		forAction: async (path) => ({
			controller,
			guards: guardList,
			middleware: chainFor(chain, path),
		}),
	};
}

/**
 * The file and export a `lazy()` loader imports: `() => import("…")` is the default export, and
 * `.then((it) => it.name)` or `.then((it) => it.name(…))` picks `name`.
 */
async function loadedModule(
	project: Project,
	module: Module,
	loader: FunctionNode,
): Promise<ControllerRef | null> {
	let body = loader.body;
	let picked: string | null = "default";
	if (body?.kind === "call" && body.callee.kind === "member" && body.callee.property === "then") {
		let pick = body.args[0]?.node;
		let selected = pick?.kind === "function" ? pick.body : null;
		if (selected?.kind === "call") selected = selected.callee;
		picked = selected?.kind === "member" ? selected.property : null;
		body = body.callee.object;
	}
	if (body?.kind !== "import") return null;
	let file = await project.resolve(module.path, body.specifier);
	if (file === null) {
		project.diagnostics.push(
			`${module.path}: ${body.specifier} does not resolve to a project file`,
		);
		return null;
	}
	return { file, export: picked };
}

/** The middleware the controller `ref` declares, read from its file; empty when it cannot be read. */
async function controllerChain(
	project: Project,
	ref: ControllerRef,
): Promise<ControllerChain | null> {
	if (ref.file === null || ref.export === null) return null;
	let module = await project.load(ref.file);
	if (module === null) return null;
	let found = await project.exported(module, ref.export);
	if (found === null) return null;
	let node = found.node;
	if (node.kind === "identifier") {
		let binding = await project.bind(found.module, node.name);
		if (binding.kind !== "local") return null;
		node = binding.node;
	}
	if (node.kind === "object") return inlineChain(project, found.module, node);
	if (node.kind !== "call") return null;
	let options = [...node.args].reverse().find((argument) => argument.node.kind === "object")?.node;
	return options?.kind === "object" ? inlineChain(project, found.module, options) : null;
}

/** The `middleware` of a controller or action object, and of each action under `actions`. */
async function inlineChain(
	project: Project,
	module: Module,
	node: ObjectNode,
): Promise<ControllerChain> {
	let middleware = property(node, "middleware");
	let actions = new Map<string, ControllerChain>();
	let declared = property(node, "actions");
	if (declared?.kind === "object") {
		for (let entry of declared.entries) {
			if ("spread" in entry || entry.value.kind !== "object") continue;
			actions.set(entry.key, await inlineChain(project, module, entry.value));
		}
	}
	return {
		middleware: middleware === undefined ? [] : await middlewareList(project, module, middleware),
		actions,
	};
}

/** The chain for the action at `path`: the controller's own, then each nested action's. */
function chainFor(chain: ControllerChain | null, path: readonly string[]): MiddlewareEntry[] {
	if (chain === null) return [];
	let entries = [...chain.middleware];
	let current: ControllerChain | undefined = chain;
	for (let key of path) {
		current = current?.actions.get(key);
		if (current === undefined) break;
		entries.push(...current.middleware);
	}
	return entries;
}

/**
 * The middleware an expression lists. Arrays are read element by element, and an array held
 * in a top-level variable (`CMS_GUARDS`), directly or spread, is expanded to what it holds.
 */
export async function middlewareList(
	project: Project,
	module: Module,
	node: Node,
	seen: ReadonlySet<string> = new Set(),
): Promise<MiddlewareEntry[]> {
	if (node.kind === "array") {
		let entries: MiddlewareEntry[] = [];
		for (let element of node.elements) {
			if (element.spread)
				entries.push(...(await middlewareList(project, module, element.node, seen)));
			else entries.push(await middlewareEntry(project, module, element.node));
		}
		return entries;
	}
	if (node.kind === "identifier" && !seen.has(node.name)) {
		let binding = await project.bind(module, node.name);
		if (binding.kind === "local" && binding.node.kind === "array") {
			return middlewareList(project, module, binding.node, new Set([...seen, node.name]));
		}
	}
	return [await middlewareEntry(project, module, node)];
}

/** One middleware: its expression as written and the module its name comes from. */
async function middlewareEntry(
	project: Project,
	module: Module,
	node: Node,
): Promise<MiddlewareEntry> {
	let text = module.reader.text(node);
	let name;
	if (node.kind === "function") name = "(inline)";
	else if (text.length > NAME_LIMIT && node.kind === "call")
		name = `${module.reader.text(node.callee)}(…)`;
	else name = text;
	let root: Node = node;
	while (root.kind === "call" || root.kind === "member") {
		root = root.kind === "call" ? root.callee : root.object;
	}
	let from: string | null = null;
	if (root.kind === "identifier") {
		let binding = await project.bind(module, root.name);
		if (binding.kind === "import") from = binding.file ?? binding.specifier;
	}
	return { name, from };
}

/** The value of `key` in an object literal, or `undefined`. */
function property(node: ObjectNode, key: string): Node | undefined {
	for (let entry of node.entries) if (!("spread" in entry) && entry.key === key) return entry.value;
	return undefined;
}
