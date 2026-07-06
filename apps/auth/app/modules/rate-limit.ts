/**
 * Rate-limiting module for the auth app. Wraps the Cloudflare rate limiter
 * bindings behind a `checkRateLimit` helper keyed per endpoint (token,
 * introspect, revoke, authorize, login) and provides a standard 429 response,
 * protecting the OAuth endpoints from abuse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { tooManyRequests } from "@pkg/http/response/json";

import { bindings } from "~/middleware/cloudflare";
import { logger } from "~/middleware/logger";

/**
 * Check rate limit for a given key
 * @param limiter The rate limiter name (e.g., "TOKEN_RATE_LIMITER")
 * @param key The key to rate limit on (e.g., client_id or IP)
 * @returns true if allowed, false if rate limited
 */
export async function checkRateLimit(
	limiter:
		| "TOKEN_RATE_LIMITER"
		| "INTROSPECT_RATE_LIMITER"
		| "REVOKE_RATE_LIMITER"
		| "AUTHORIZE_RATE_LIMITER"
		| "LOGIN_RATE_LIMITER",
	key: string,
): Promise<boolean> {
	let env = bindings();
	let rateLimiter = env[limiter];

	let { success } = await rateLimiter.limit({ key });

	if (!success) {
		logger.info("rate_limit_exceeded", { limiter, key });
	}

	return success;
}

/**
 * Create a 429 Too Many Requests response
 */
export function rateLimitResponse(): Response {
	return tooManyRequests(
		{
			error: "too_many_requests",
			error_description: "Rate limit exceeded. Please try again later.",
		},
		{ headers: { "Retry-After": "60" } },
	);
}
