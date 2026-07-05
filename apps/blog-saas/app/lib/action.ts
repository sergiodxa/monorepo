import type { Action, RequestMethod } from "remix/fetch-router";

/**
 * Types a route handler so `context.params` is inferred from the route pattern.
 * @param action - The action handler to type.
 * @returns The same action, typed against its pattern.
 */
export default function action<
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	method extends RequestMethod | "ANY",
	pattern extends string,
>(action: Action<pattern>): Action<pattern> {
	return action;
}
