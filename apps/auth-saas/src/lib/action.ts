import type { Action, RequestMethod } from "remix/fetch-router";

export default function action<
	method extends RequestMethod | "ANY",
	pattern extends string,
	T extends Action<method, pattern> = Action<method, pattern>,
>(action: T): T {
	return action;
}
