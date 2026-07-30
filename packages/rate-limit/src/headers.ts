/**
 * Serialization of a decision into the IETF draft rate limit response fields,
 * plus the helper that writes them onto a finished response. A field a backend
 * cannot report is left out entirely, because a guessed number is worse than none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

import { toSeconds } from "@pkg/duration";

import type { RateLimitDecision } from "./types";

/** Quota state for the current window: `limit`, `remaining`, and `reset`. */
const RATE_LIMIT_FIELD = "RateLimit";

/** The policy the quota came from, as `<limit>;w=<window seconds>`. */
const RATE_LIMIT_POLICY_FIELD = "RateLimit-Policy";

/** Seconds to wait before retrying, sent only on a limited response. */
const RETRY_AFTER_FIELD = "Retry-After";

/**
 * Serializes a decision into response header name and value pairs.
 *
 * `RateLimit` carries `remaining` only when the backend reported it, so a
 * Cloudflare binding limit advertises `limit` and `reset` and stays silent about a
 * number it does not have. `Retry-After` is added only when the attempt was
 * denied, matching its meaning: it answers "when may I try again", not "when does
 * my quota refill".
 *
 * @param decision - The decision to describe.
 * @param window - The adapter's window, needed for the policy field's `w` parameter.
 * @returns Header pairs in the order they should be written, possibly empty.
 *
 * @example
 * rateLimitHeaders(decision, "10 seconds");
 * // [["RateLimit", "limit=10, remaining=0, reset=7"], ["RateLimit-Policy", "10;w=10"], ["Retry-After", "7"]]
 */
export function rateLimitHeaders(
	decision: RateLimitDecision,
	window: DurationInput,
): [string, string][] {
	let entries: [string, string][] = [];
	let hasLimit = Number.isFinite(decision.limit);
	let hasReset = Number.isFinite(decision.retryAfter);

	let quota: string[] = [];
	if (hasLimit) quota.push(`limit=${decision.limit}`);
	if (decision.remaining !== null && Number.isFinite(decision.remaining)) {
		quota.push(`remaining=${decision.remaining}`);
	}
	if (hasReset) quota.push(`reset=${decision.retryAfter}`);
	if (quota.length > 0) entries.push([RATE_LIMIT_FIELD, quota.join(", ")]);

	let windowSeconds = toSeconds(window);
	if (hasLimit && Number.isFinite(windowSeconds) && windowSeconds > 0) {
		entries.push([RATE_LIMIT_POLICY_FIELD, `${decision.limit};w=${windowSeconds}`]);
	}

	if (!decision.allowed && hasReset) {
		entries.push([RETRY_AFTER_FIELD, String(decision.retryAfter)]);
	}

	return entries;
}

/**
 * Writes the rate limit fields onto a response, falling back to an equivalent
 * response when the original's headers reject mutation, as platform-produced
 * responses do.
 *
 * @param response - The response to annotate.
 * @param decision - The decision to describe.
 * @param window - The adapter's window, for the policy field.
 * @returns The same response, or an equivalent one carrying the headers.
 *
 * @example
 * return applyRateLimitHeaders(await next(), decision, adapter.window);
 */
export function applyRateLimitHeaders(
	response: Response,
	decision: RateLimitDecision,
	window: DurationInput,
): Response {
	let entries = rateLimitHeaders(decision, window);
	if (entries.length === 0) return response;

	try {
		for (let [name, value] of entries) response.headers.set(name, value);
		return response;
	} catch {
		let headers = new Headers(response.headers);
		for (let [name, value] of entries) headers.set(name, value);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}
