/**
 * The denial response every limited request gets. The decision travels with it, so
 * the standard quota fields ship whoever built the body: a limited API answers JSON
 * and a limited page answers HTML, and neither can forget to say what the limit was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";

import type { RateLimitDecision } from "./types.js";

import { applyRateLimitHeaders } from "./headers.js";

/** The status a denied request answers with, plus the reason phrase RFC 6585 gives it. */
const TOO_MANY_REQUESTS = { status: 429, statusText: "Too Many Requests" } as const;

/**
 * Builds the `429` for a request that spent its budget, carrying the quota fields the
 * decision supports. The status holds against an `init` that disagrees, and no media
 * type is added, so a body arrives labelled the way the caller labelled it.
 *
 * @param decision - The denial the adapter answered with, serialized into the headers.
 * @param window - The adapter's window, for the `RateLimit-Policy` field.
 * @param body - The response body, in any form `Response` accepts.
 * @param init - Headers and other response options; `status` is fixed at `429`.
 * @returns A `429 Too Many Requests` response carrying the rate limit headers.
 * @example
 * return tooManyRequests(decision, adapter.window, JSON.stringify({ error: "too_many_requests" }), {
 * 	headers: { "Content-Type": "application/json" },
 * });
 * @example
 * return tooManyRequests(decision, adapter.window, await renderLimitPage(), {
 * 	headers: { "Content-Type": "text/html" },
 * });
 */
export function tooManyRequests(
	decision: RateLimitDecision,
	window: DurationInput,
	body?: BodyInit | null,
	init?: ResponseInit,
): Response {
	let response = new Response(body, { ...init, ...TOO_MANY_REQUESTS });
	return applyRateLimitHeaders(response, decision, window);
}
