/**
 * Router middleware that turns a thrown `Response` into the request's response.
 *
 * `remix/router` inspects only the value a middleware or handler *returns*, and
 * has no catch of its own, so a thrown `Response` escapes the router and the
 * runtime reports it as a 500. A middleware, though, receives `next()` as a
 * promise it can `try`/`catch` and may return any `Response` — which is all it
 * takes to make `throw redirect(to)` work at any call depth.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

/**
 * Creates a middleware that answers the request with any `Response` thrown
 * downstream of it, letting a helper several calls deep — `currentUser()`
 * redirecting to the login page, say — end the request without threading the
 * request context back out to the handler. Anything else thrown re-throws
 * untouched so real failures still reach the runtime's error reporting.
 *
 * Install it *below* every middleware that inspects or decorates the response:
 * a throw skips the work each middleware above the throw site had queued after
 * its own `next()`, and only the ones above this middleware still see the
 * response it recovers.
 *
 * @returns The middleware to place at the point in the chain from which thrown
 * responses become the request's response.
 */
export function catchResponse(): Middleware {
	return async function catchResponseMiddleware(_context, next) {
		try {
			return await next();
		} catch (error) {
			if (error instanceof Response) return error;
			throw error;
		}
	};
}
