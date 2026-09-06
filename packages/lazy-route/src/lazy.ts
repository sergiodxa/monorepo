/**
 * Maps a route to a module that is imported on the first request that reaches it,
 * instead of at startup. A Worker pays for every module its entry point pulls in
 * before it can answer anything, and a route nobody hit did not need to be there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestHandler } from "remix/router";

import type { AnyContext, Loadable, LoadedController, LoadedMiddleware } from "./types.js";

import { runMiddleware } from "./run-middleware.js";

/** The default export when the loader resolves a module, the resolved value otherwise. */
type Loaded<module> = module extends { default: infer value } ? value : module;

/** The handler and the chain that runs ahead of it, once both are known. */
interface Resolved {
	middleware: readonly LoadedMiddleware[];
	handler: RequestHandler<AnyContext>;
}

/**
 * Defers importing a route's module until the first request matches it, and reuses it
 * from then on. Pass the result wherever an action or a controller goes: it keeps the
 * module's type, and the `middleware` that module declares still runs ahead of it.
 *
 * @param load Returns the module, usually a bare `import()`
 * @returns A stand-in typed as the module's default export, which `router.map()` accepts
 */
export function lazy<module extends Loadable | { default: Loadable }>(
	load: () => Promise<module>,
): Loaded<module> {
	let pending: Promise<unknown> | undefined;

	function loaded(): Promise<unknown> {
		pending ??= (async () => unwrap(await load()))();
		return pending;
	}

	let handlers = new Map<string, RequestHandler<AnyContext>>();

	function actionFor(name: string): RequestHandler<AnyContext> {
		let existing = handlers.get(name);
		if (existing) return existing;

		let handler: RequestHandler<AnyContext> = async (context) => {
			let action = resolveAction(await loaded(), name);
			return runMiddleware(action.middleware, context, action.handler);
		};

		handlers.set(name, handler);
		return handler;
	}

	/**
	 * One value stands in for both shapes the router accepts, because which one it is
	 * depends on the map target rather than on the module: the router reads `handler`
	 * for a single route and `actions` for a route map, and never both.
	 */
	let stand = {
		async handler(context: AnyContext): Promise<Response> {
			let action = resolve(await loaded());
			return runMiddleware(action.middleware, context, action.handler);
		},

		/**
		 * Answers for any name, since the route map holding the real ones is known only
		 * to the router. Enumerating it yields nothing, which is what tells the router
		 * every action it asks for is present and none of them is a stray.
		 */
		actions: new Proxy({} as Record<string, RequestHandler<AnyContext>>, {
			get(_, name) {
				return typeof name === "string" ? actionFor(name) : undefined;
			},
			getOwnPropertyDescriptor(_, name) {
				if (typeof name !== "string") return undefined;
				return {
					value: actionFor(name),
					writable: true,
					enumerable: true,
					configurable: true,
				};
			},
			has(_, name) {
				return typeof name === "string";
			},
			ownKeys() {
				return [];
			},
		}),
	};

	return stand as unknown as Loaded<module>;
}

/** Reads the default export off a module, and takes any other value as the handler itself. */
function unwrap(module: unknown): unknown {
	if (isRecord(module) && "default" in module) return module.default;
	return module;
}

/** Resolves the module of a route mapped on its own. */
function resolve(loaded: unknown): Resolved {
	if (isController(loaded)) {
		throw new TypeError(
			"Loaded a controller for a single route; map the route map it was written for, or load an action",
		);
	}
	return normalize(loaded);
}

/** Resolves one action of the module of a route map, behind the controller's own chain. */
function resolveAction(loaded: unknown, name: string): Resolved {
	if (!isController(loaded)) {
		throw new TypeError(
			"Loaded an action for a route map; map the route it was written for, or load a controller",
		);
	}

	if (!Object.hasOwn(loaded.actions, name)) {
		throw new TypeError(`Missing action \`${name}\` in loaded controller`);
	}

	let action = normalize(loaded.actions[name]);

	return {
		middleware: [...(loaded.middleware ?? []), ...action.middleware],
		handler: action.handler,
	};
}

/** Splits an action into its handler and its middleware, whichever form it took. */
function normalize(action: unknown): Resolved {
	if (typeof action === "function") {
		return { middleware: [], handler: action as RequestHandler<AnyContext> };
	}

	if (isRecord(action) && typeof action.handler === "function") {
		return {
			middleware: (action.middleware as readonly LoadedMiddleware[] | undefined) ?? [],
			handler: action.handler as RequestHandler<AnyContext>,
		};
	}

	throw new TypeError(
		"Expected a request handler function or action object with a function `handler` property",
	);
}

function isController(value: unknown): value is LoadedController {
	return isRecord(value) && isRecord(value.actions);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
