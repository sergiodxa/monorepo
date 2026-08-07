/**
 * Spending a rate limiter's budget and turning a refusal into the published `429`.
 * Wraps `@pkg/rate-limit`'s adapters so every protected endpoint answers with the same
 * body and headers, and so a limiter outage lets traffic through instead of stopping
 * token issuance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter } from "@pkg/rate-limit";

import { toSeconds } from "@pkg/duration";
import { tooManyRequests } from "@pkg/http/response/json";
import { applyRateLimitHeaders } from "@pkg/rate-limit";
import { isFailure } from "@pkg/result";
import { getContext } from "remix/async-context-middleware";

/** Error code a refused request carries. Relying parties may match on it. */
const LIMITED_ERROR = "too_many_requests";

/** Description sent alongside {@link LIMITED_ERROR}, verbatim as clients have always read it. */
const LIMITED_DESCRIPTION = "Rate limit exceeded. Please try again later.";

/**
 * Spends one unit of a limiter's budget for a key.
 *
 * Returns the response to send when the budget is gone and `null` when the request may
 * continue, so a caller cannot read the decision and forget to act on it.
 *
 * Fails open: a binding that cannot answer is logged and the request proceeds, because
 * a limiter outage must not take down logins.
 *
 * `Retry-After` reports the limiter's full window rather than the time left in the
 * current one. It is the value published to relying parties, and a client that waits
 * the whole window is always safe, whereas one that waits a shorter estimate of a
 * boundary the platform never actually reports may not be.
 *
 * @param adapter - The limiter to spend from.
 * @param key - Identity the budget belongs to, such as a client id or a client IP.
 * @returns A `429` to return immediately, or `null` when the request is allowed.
 */
export async function spendRateLimit(adapter: Adapter, key: string): Promise<Response | null> {
	let result = await adapter.consume(key);
	let logger = getContext().logger;

	if (isFailure(result)) {
		logger.error("rate_limit_unavailable", { key, error: result.error.message });
		return null;
	}

	let decision = result.data;
	if (decision.allowed) return null;

	logger.info("rate_limit_exceeded", { key });

	let response = applyRateLimitHeaders(
		tooManyRequests({ error: LIMITED_ERROR, error_description: LIMITED_DESCRIPTION }),
		decision,
		adapter.window,
	);

	response.headers.set("Retry-After", String(toSeconds(adapter.window)));

	return response;
}
