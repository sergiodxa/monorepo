/**
 * The shapes a lazily loaded module is checked against once it arrives. What a
 * loader resolves to is unknown until it does, so these describe the router's
 * handler contract structurally rather than restating its exported types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";

/** Any request context, since a loaded handler declares the shape it needs. */
export type AnyContext = RequestContext<any, any>;

/** Runs before a loaded handler, exactly as a mapped middleware would. */
export interface LoadedMiddleware {
	(context: AnyContext, next: () => Promise<Response>): Response | Promise<Response>;
}

/**
 * Middleware declared at the map call rather than inside the module. Typed as a
 * `Middleware` with no context transform, so a middleware that publishes a context
 * value is rejected here: the loaded handler's type is the module's own and cannot
 * grow to know about a value declared at the map call.
 */
export type FrontMiddleware = Middleware;

/** A loaded controller, whose actions are keyed by the names of a route map. */
export interface LoadedController {
	middleware?: readonly LoadedMiddleware[] | undefined;
	actions: Record<string, unknown>;
}

/**
 * What a loader is allowed to resolve to. Wide on purpose: narrowing it here would
 * reject valid modules without catching the mistake that matters, which is pointing
 * a route at the wrong module, and that one surfaces at the `router.map()` call.
 */
export type Loadable = RequestHandler<any> | { handler: RequestHandler<any> } | { actions: object };
