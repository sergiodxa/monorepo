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

import type { Middleware } from "remix/fetch-router";

/**
 * Creates a middleware that dispatches `HEAD` requests as `GET` and strips the
 * response body.
 *
 * It rewrites `context.method`, the same mutable field the method-override
 * middleware writes, rather than re-entering the router with a synthetic request.
 * Nothing is short-circuited: the request keeps travelling the very chain a `GET`
 * would, so authentication, authorization, rate limiting and cross-origin
 * protection all still run, and a route with no `GET` — a form's `POST` half, a
 * webhook — matches nothing and still gets the default handler's 404.
 *
 * Install it first in the router's global chain. Everything after it then sees a
 * plain `GET`, which is what makes the two methods provably indistinguishable to
 * the guards; and because `GET` and `HEAD` are both safe methods, no middleware
 * that keys off method safety changes its mind about the request.
 *
 * The response body is dropped rather than drained: a `HEAD` must not send
 * content, and the caller never subscribes to the stream. Headers are carried over
 * untouched, so `Content-Type` and any `Content-Length` the handler set survive.
 *
 * @returns The middleware to place at the head of the router's global chain.
 */
export function headRequests(): Middleware {
	/**
	 * Rewrites a `HEAD` into a `GET`, runs the rest of the chain, and returns the
	 * result without its body.
	 *
	 * @param context - The request context whose method is rewritten in place.
	 * @param next - Runs the remaining middleware and the matched handler.
	 * @returns The bodyless response for a `HEAD`, or the untouched response otherwise.
	 */
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
