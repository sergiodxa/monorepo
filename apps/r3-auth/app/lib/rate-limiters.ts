/**
 * Opens the five rate limiters protecting the OAuth, authorization and login surfaces,
 * once per isolate, so every endpoint spends from the budget meant for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import RateLimiters from "~/app/services/rate-limiters";

/** The isolate's limiters, opened by whichever request reaches them first. */
let limiters: RateLimiters | undefined;

/**
 * Wraps this deployment's five limiter bindings in the policies declared for them.
 *
 * @returns The limiters, shared by every request this isolate serves.
 * @example
 * let middleware = [rateLimiters(createRateLimiters)];
 */
export function createRateLimiters(): RateLimiters {
	return (limiters ??= new RateLimiters({
		token: env.TOKEN_RATE_LIMITER,
		introspect: env.INTROSPECT_RATE_LIMITER,
		revoke: env.REVOKE_RATE_LIMITER,
		authorize: env.AUTHORIZE_RATE_LIMITER,
		login: env.LOGIN_RATE_LIMITER,
	}));
}
