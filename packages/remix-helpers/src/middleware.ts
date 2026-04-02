import type { Middleware, MiddlewareContextTransform, RequestMethod } from "remix/fetch-router";

/**
 * Preserves method and params inference for fetch-router middleware functions.
 *
 * Use this helper to define router middleware functions with explicit method
 * and params typing.
 */
export default function middleware<
	method extends RequestMethod | "ANY",
	params extends Record<string, any>,
	transform extends MiddlewareContextTransform,
	T extends Middleware<method, params, transform> = Middleware<method, params, transform>,
>(middleware: T): T {
	return middleware;
}
