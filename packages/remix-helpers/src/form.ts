import type { Controller } from "@remix-run/fetch-router";
import type { Route } from "@remix-run/fetch-router/routes";

/**
 * Creates a typed form controller constrained to `GET` (index) and `POST` (action).
 *
 * Use this helper for routes defined with `form(path)` so `index` and `action`
 * handlers stay aligned to the same pattern.
 */
export default function form<
	pattern extends string,
	T extends Controller<{
		index: Route<"GET", pattern>;
		action: Route<"POST", pattern>;
	}> = Controller<{
		index: Route<"GET", pattern>;
		action: Route<"POST", pattern>;
	}>,
>(controller: T) {
	return controller;
}
