import type { Controller, RequestContext } from "remix/fetch-router";
import type { RouteMap } from "remix/fetch-router/routes";

import type { DefaultContext } from "./context";

/**
 * Preserves the full route map type for a fetch-router controller.
 *
 * Use this helper for full controller definitions, typically entries created
 * with `resources(path)` in the app route map.
 */
export default function controller<
	routes extends RouteMap,
	context extends RequestContext<any, any> = DefaultContext,
>(controller: Controller<routes, context>): Controller<routes, context> {
	return controller;
}
