/**
 * Spending a rate limiter's budget and turning a refusal into the published
 * `429`. Wraps `@sdxc/rate-limit`'s adapters so every protected endpoint
 * answers with the same body and headers, and a limiter outage still lets
 * token issuance proceed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter } from "@sdxc/rate-limit";

import { toSeconds } from "@sdxc/duration";
import { tooManyRequests } from "@sdxc/http/response/json";
import { applyRateLimitHeaders } from "@sdxc/rate-limit";
import { isFailure } from "@sdxc/result";
import { getContext } from "remix/middleware/async-context";

/** Error code a refused request carries. Relying parties may match on it. */
const LIMITED_ERROR = "too_many_requests";

/** Description sent alongside {@link LIMITED_ERROR}, verbatim as clients have always read it. */
const LIMITED_DESCRIPTION = "Rate limit exceeded. Please try again later.";

/**
 * Spends one unit of a limiter's budget for a key, returning a response to
 * send when it's gone. Fails open: a binding that cannot answer is logged and
 * the request proceeds, since a limiter outage must not take down logins.
 *
 * @param adapter - The limiter to spend from.
 * @param key - Identity the budget belongs to, such as a client id or a client IP.
 * @returns A `429` to return immediately — its `Retry-After` reports the
 * limiter's full window, the value published to relying parties and always
 * safe for a client to wait out in full — or `null` when the request may
 * continue, so a caller always acts on the returned decision.
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
