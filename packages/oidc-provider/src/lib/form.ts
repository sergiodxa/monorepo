import type { Controller } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

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
