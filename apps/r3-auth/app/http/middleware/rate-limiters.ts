/**
 * Publishes the app's rate limiters as `ctx.limiters`, so a protected endpoint spends
 * from its budget off the context it was already given and a test hands in limiters with
 * budgets small enough to reach in a few requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

import type Limiters from "~/app/services/rate-limiters";

/** Where the limiters live on a request context, and the key a test reads them back from. */
export const RateLimiters = createContextKey<Limiters>();

declare module "remix/router" {
	interface RequestContext {
		/** The five rate limiters, published by the global `rateLimiters()` middleware. */
		limiters: Limiters;
	}
}

/**
 * Publishes the limiters for the request about to run.
 *
 * @param source - Opens the limiters, called per request so the bindings are read when one
 * arrives rather than when this module loads.
 * @returns The middleware, for a router's chain.
 * @example
 * let middleware = [asyncContext(), rateLimiters(createRateLimiters)];
 */
export function rateLimiters(source: () => Limiters): Middleware {
	return (ctx, next) => {
		ctx.set(RateLimiters, source(), { property: "limiters" });
		return next();
	};
}
