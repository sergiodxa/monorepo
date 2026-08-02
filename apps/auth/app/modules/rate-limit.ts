/**
 * Rate limiting for the auth app's OAuth, authorization and login endpoints.
 * Wraps each Cloudflare rate limiter binding in an adapter carrying the limit and
 * period declared for it, so a refused request answers with the quota it actually
 * hit instead of a fixed retry hint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CloudflareAdapterOptions } from "@pkg/rate-limit";

import { tooManyRequests } from "@pkg/http/response/json";
import { applyRateLimitHeaders, CloudflareAdapter } from "@pkg/rate-limit";
import { isFailure } from "@pkg/result";

import { bindings } from "~/middleware/cloudflare";
import { logger } from "~/middleware/logger";

/**
 * Declared limit and period of every rate limiter binding, mirroring the
 * `simple: { limit, period }` blocks in `wrangler.jsonc`.
 *
 * The platform never reports either value back, so this table is the only source
 * for the `RateLimit` fields. Drift does not weaken the limiting, but it makes
 * every emitted header wrong, which is worse than sending none.
 */
const RATE_LIMIT_POLICIES = {
	TOKEN_RATE_LIMITER: { limit: 20, window: "1 minute" },
	INTROSPECT_RATE_LIMITER: { limit: 100, window: "1 minute" },
	REVOKE_RATE_LIMITER: { limit: 50, window: "1 minute" },
	AUTHORIZE_RATE_LIMITER: { limit: 30, window: "1 minute" },
	LOGIN_RATE_LIMITER: { limit: 10, window: "1 minute" },
} as const satisfies Record<string, CloudflareAdapterOptions>;

/** Logged when a request is refused: expected traffic, not a fault. */
const EXCEEDED_EVENT = "rate_limit_exceeded";

/** Logged when the binding could not answer and the request was let through. */
const UNAVAILABLE_EVENT = "rate_limit_unavailable";

/** Error code the OAuth endpoints publish for a refused request. */
const LIMITED_ERROR = "too_many_requests";

/** Description sent alongside {@link LIMITED_ERROR}. */
const LIMITED_DESCRIPTION = "Rate limit exceeded. Please try again later.";

/** Rate limiter bindings this app declares, one per protected surface. */
export type RateLimiterName = keyof typeof RATE_LIMIT_POLICIES;

/**
 * Spends one unit of a limiter's budget for a key.
 *
 * Returns the response to send when the budget is gone and `null` when the
 * request may continue, so a caller cannot read the decision and forget to act on
 * it. The refusal keeps the published `too_many_requests` body and adds
 * `RateLimit`, `RateLimit-Policy` and `Retry-After` derived from the binding's
 * declared policy, so a client backs off for as long as the window actually has
 * left rather than a hardcoded minute.
 *
 * Fails open: a binding that cannot answer is logged at error level and the
 * request proceeds, because a limiter outage must not stop token issuance.
 *
 * @param limiter - Which declared limiter to spend from.
 * @param key - Identity the budget belongs to, such as a client id or client IP.
 * @returns A `429` to return immediately, or `null` when the request is allowed.
 */
export async function rateLimit(limiter: RateLimiterName, key: string): Promise<Response | null> {
	let adapter = new CloudflareAdapter(bindings()[limiter], RATE_LIMIT_POLICIES[limiter]);
	let result = await adapter.consume(key);

	if (isFailure(result)) {
		logger.error(UNAVAILABLE_EVENT, { limiter, key, error: result.error.message });
		return null;
	}

	let decision = result.data;
	if (decision.allowed) return null;

	logger.info(EXCEEDED_EVENT, { limiter, key, retryAfter: decision.retryAfter });

	let response = tooManyRequests({
		error: LIMITED_ERROR,
		error_description: LIMITED_DESCRIPTION,
	});

	return applyRateLimitHeaders(response, decision, adapter.window);
}
