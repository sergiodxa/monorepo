import type { Controller } from "@remix-run/fetch-router";
import type { RouteMap } from "@remix-run/fetch-router/routes";

/**
 * Preserves the full route map type for a fetch-router controller.
 *
 * Use this helper for full controller definitions, typically entries created
 * with `resources(path)` in the app route map.
 */
export default function controller<routes extends RouteMap>(
	controller: Controller<routes>,
): Controller<routes> {
	return controller;
}
