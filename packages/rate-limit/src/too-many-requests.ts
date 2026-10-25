/**
 * The denial response every limited request gets. The decision travels with it, so
 * the standard quota fields ship whoever built the body: a limited API answers JSON
 * or the standard `quota-exceeded` problem, and a limited page answers HTML.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { problem } from "@sdxc/problem";

import type { RateLimitPolicy } from "./headers.js";
import type { RateLimitDecision } from "./types.js";

import { applyRateLimitHeaders, DEFAULT_POLICY_NAME } from "./headers.js";

/** The status a denied request answers with, plus the reason phrase RFC 6585 gives it. */
const TOO_MANY_REQUESTS = { status: 429, statusText: "Too Many Requests" } as const;

/** The problem type draft-ietf-httpapi-ratelimit-headers registers for a spent quota. */
export const QUOTA_EXCEEDED_TYPE = "https://iana.org/assignments/http-problem-types#quota-exceeded";

/** The title the draft gives {@link QUOTA_EXCEEDED_TYPE}. */
const QUOTA_EXCEEDED_TITLE = "Request cannot be satisfied as assigned quota has been exceeded";

/**
 * Builds the `429` for a request that spent its budget, carrying the quota fields the
 * decision supports. The status holds against an `init` that disagrees, and no media
 * type is added, so a body arrives labelled the way the caller labelled it.
 *
 * @param decision - The denial the adapter answered with, serialized into the headers.
 * @param policy - The policy it was made under; an `Adapter` fits.
 * @param body - The response body, in any form `Response` accepts.
 * @param init - Headers and other response options; `status` is fixed at `429`.
 * @returns A `429 Too Many Requests` response carrying the rate limit headers.
 * @example
 * return tooManyRequests(decision, adapter, JSON.stringify({ error: "too_many_requests" }), {
 * 	headers: { "Content-Type": "application/json" },
 * });
 * @example
 * return tooManyRequests(decision, { ...adapter, name: "login" }, await renderLimitPage(), {
 * 	headers: { "Content-Type": "text/html" },
 * });
 */
export function tooManyRequests(
	decision: RateLimitDecision,
	policy: RateLimitPolicy,
	body?: BodyInit | null,
	init?: ResponseInit,
): Response {
	let response = new Response(body, { ...init, ...TOO_MANY_REQUESTS });
	return applyRateLimitHeaders(response, decision, policy);
}

/**
 * Builds the `429` as the draft's `quota-exceeded` problem, naming the policy in
 * `violated-policies` so a client can match it against the `RateLimit` Item it read.
 *
 * @param decision - The denial the adapter answered with, serialized into the headers.
 * @param policy - The policy it was made under; an `Adapter` fits.
 * @param detail - An explanation for this occurrence, written as the problem's `detail`.
 * @param init - Headers and other response options; `status` is fixed at `429`.
 * @returns An `application/problem+json` `429` carrying the rate limit headers.
 * @example
 * if (!decision.allowed) return quotaExceeded(decision, adapter);
 * // {"type":"https://iana.org/assignments/http-problem-types#quota-exceeded",…,"violated-policies":["default"]}
 */
export function quotaExceeded(
	decision: RateLimitDecision,
	policy: RateLimitPolicy,
	detail?: string,
	init?: ResponseInit,
): Response {
	let response = problem(
		{
			status: TOO_MANY_REQUESTS.status,
			type: QUOTA_EXCEEDED_TYPE,
			title: QUOTA_EXCEEDED_TITLE,
			detail,
			extensions: { "violated-policies": [policy.name ?? DEFAULT_POLICY_NAME] },
		},
		{ ...init, statusText: TOO_MANY_REQUESTS.statusText },
	);
	return applyRateLimitHeaders(response, decision, policy);
}
