import type { Action, RequestContext, RequestMethod } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import type { DefaultContext } from "./context";

type ActionFromRoute<
	route extends Route<RequestMethod | "ANY", string>,
	context extends RequestContext<any, any> = DefaultContext,
> = route extends Route<RequestMethod | "ANY", infer pattern> ? Action<pattern, context> : never;

/**
 * Preserves route-specific `Action` types while keeping implementation ergonomic.
 *
 * Use this wrapper for single action routes, typically entries defined with
 * `get(path)` or `post(path)` in the app route map.
 */
export default function action<
	route extends Route<RequestMethod | "ANY", string>,
	context extends RequestContext<any, any> = DefaultContext,
	T extends ActionFromRoute<route, context> = ActionFromRoute<route, context>,
>(action: T): T {
	return action;
}
