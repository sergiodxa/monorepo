import type { Action, RequestMethod } from "@remix-run/fetch-router";
import type { Route } from "@remix-run/fetch-router/routes";

type ActionFromRoute<route extends Route<RequestMethod | "ANY", string>> =
	route extends Route<infer method, infer pattern> ? Action<method, pattern> : never;

/**
 * Preserves route-specific `Action` types while keeping implementation ergonomic.
 *
 * Use this wrapper for single action routes, typically entries defined with
 * `get(path)` or `post(path)` in the app route map.
 */
export default function action<
	route extends Route<RequestMethod | "ANY", string>,
	T extends ActionFromRoute<route> = ActionFromRoute<route>,
>(action: T): T {
	return action;
}
