/**
 * Tiny identity helper that contextually types a value as a router `RequestHandler`,
 * so a handler written inline gets its context/return types inferred without a
 * manual annotation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RequestContext, RequestHandler } from "remix/fetch-router";

/**
 * Identity helper that types a value as a `RequestHandler` for the router.
 * @param handler - Request handler to type and return.
 * @returns The same handler, typed as a `RequestHandler`.
 */
export default function requestHandler<
	context extends RequestContext<any, any> = RequestContext,
	handler extends RequestHandler<context> = RequestHandler<context>,
>(handler: handler): handler {
	return handler;
}
