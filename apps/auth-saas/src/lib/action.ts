import type { Action, RequestMethod } from "remix/fetch-router";

/**
 * Types a route handler so `context.params` is inferred from the route pattern.
 *
 * The current fetch-router `Action` type is `Action<route, context, middleware>`,
 * so the `pattern` (not the method) drives param typing. The `method` type
 * parameter is retained only for call-site readability, e.g.
 * `action<"GET", "/dashboard/tenants/:id">(...)`.
 */
export default function action<
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	method extends RequestMethod | "ANY",
	pattern extends string,
>(action: Action<pattern>): Action<pattern> {
	return action;
}
