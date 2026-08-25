/**
 * Router middleware that answers `HEAD` requests with the `GET` representation's
 * status and headers and no body, as RFC 9110 §9.3.2 requires. The fetch router
 * matches a route's method by strict equality, so without this a `HEAD` probe
 * falls through to the default handler and a monitor reads a healthy page as a
 * 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

/**
 * Creates a middleware that dispatches `HEAD` requests as `GET`, strips the
 * response body, and keeps `HEAD` on the same chain as `GET` so auth, rate
 * limiting, and other guards behave identically; install it first in the chain.
 *
 * @returns The middleware to place at the head of the router's global chain.
 */
export function headRequests(): Middleware {
	return async function headRequestsMiddleware(context, next) {
		if (context.method !== "HEAD") return next();

		context.method = "GET";

		let response = await next();

		return new Response(null, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	};
}
