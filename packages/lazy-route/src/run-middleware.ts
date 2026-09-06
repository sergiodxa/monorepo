/**
 * Runs a middleware chain that only exists once its module has loaded. The router
 * runs the middleware a route was mapped with, and a lazily mapped route has none
 * to give it, so the chain the module brought with it runs here instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestHandler } from "remix/router";

import type { AnyContext, LoadedMiddleware } from "./types.js";

/**
 * Runs each middleware in order and then the handler, giving every one a `next` that
 * continues the chain. A middleware either returns a response, which short-circuits
 * the rest, or calls `next()` and returns what came back from downstream.
 *
 * @param middleware The chain to run before the handler
 * @param context The request context every middleware and the handler receive
 * @param handler The handler that runs once the chain reaches its end
 * @returns The response from the handler, or from whichever middleware answered first
 */
export function runMiddleware(
	middleware: readonly LoadedMiddleware[],
	context: AnyContext,
	handler: RequestHandler<AnyContext>,
): Promise<Response> {
	let reached = -1;

	async function dispatch(position: number): Promise<Response> {
		if (position <= reached) throw new Error("next() called multiple times");
		reached = position;

		if (context.request.signal.aborted) throw context.request.signal.reason;

		let current = middleware[position];
		if (!current) return await handler(context);

		let downstream: Promise<Response> | undefined;

		let response = await current(context, () => {
			downstream = dispatch(position + 1);
			return downstream;
		});

		if (response instanceof Response) return response;
		if (downstream) return downstream;

		throw new Error("Middleware must return a Response or call next()");
	}

	return dispatch(0);
}
