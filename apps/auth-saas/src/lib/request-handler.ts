import type { RequestContext, RequestHandler } from "remix/fetch-router";

/**
 * Identity helper that types a value as a `RequestHandler` for the router.
 *
 * The returned handler is unchanged; the helper only gives TypeScript the
 * expected request-handler shape so route definitions stay type-safe.
 * @param handler Request handler to type and return.
 * @returns The same handler, typed as a `RequestHandler`.
 */
export default function requestHandler<
	context extends RequestContext<any, any> = RequestContext,
	handler extends RequestHandler<context> = RequestHandler<context>,
>(handler: handler): handler {
	return handler;
}
