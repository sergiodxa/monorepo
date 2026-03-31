import type { Middleware, RequestMethod } from "remix/fetch-router";

/**
 * Preserves method and params inference for fetch-router middleware functions.
 *
 * Use this helper to define router middleware functions with explicit method
 * and params typing.
 */
export default function middleware<
	method extends RequestMethod,
	params extends Record<string, any>,
	T extends Middleware<method, params> = Middleware<method, params>,
>(middleware: T): T {
	return middleware;
}
