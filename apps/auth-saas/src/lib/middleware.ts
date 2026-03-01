import type { Middleware, RequestMethod } from "remix/fetch-router";

export default function middleware<
	method extends RequestMethod,
	params extends Record<string, any>,
	T extends Middleware<method, params> = Middleware<method, params>,
>(middleware: T): T {
	return middleware;
}
