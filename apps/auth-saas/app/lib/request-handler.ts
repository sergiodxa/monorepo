/**
 * Identity helper for authoring standalone router request handlers with proper typing.
 * Returns the given handler unchanged so route definitions stay type-safe against the
 * fetch-router request-handler shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext, RequestHandler } from "remix/router";

/**
 * Identity helper that types a value as a `RequestHandler` for the router.
 *
 * The returned handler is unchanged; the helper only gives TypeScript the
 * expected request-handler shape so route definitions stay type-safe.
 * @param handler Request handler to type and return.
 * @returns The same handler, typed as a `RequestHandler`.
 * @example
 * export default requestHandler(() => new Response("Not Found", { status: 404 }));
 */
export default function requestHandler<
	context extends RequestContext<any, any> = RequestContext,
	handler extends RequestHandler<context> = RequestHandler<context>,
>(handler: handler): handler {
	return handler;
}
