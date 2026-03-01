import type { RequestHandler, RequestMethod } from "remix/fetch-router";

export default function requestHandler<
	method extends RequestMethod | "ANY" = RequestMethod | "ANY",
	params extends Record<string, any> = {},
	handler extends RequestHandler<method, params> = RequestHandler<method, params>,
>(handler: handler): handler {
	return handler;
}
