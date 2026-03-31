import type { Action, RequestContext, RequestMethod } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

type ActionFromRoute<
	route extends Route<RequestMethod | "ANY", string>,
	context extends RequestContext<any, any> = RequestContext<any, any>,
> = route extends Route<infer method, infer pattern> ? Action<method, pattern, context> : never;

/**
 * Preserves route-specific `Action` types while keeping implementation ergonomic.
 *
 * Use this wrapper for single action routes, typically entries defined with
 * `get(path)` or `post(path)` in the app route map.
 */
export default function action<
	route extends Route<RequestMethod | "ANY", string>,
	context extends RequestContext<any, any> = RequestContext<any, any>,
	T extends ActionFromRoute<route, context> = ActionFromRoute<route, context>,
>(action: T): T {
	return action;
}
