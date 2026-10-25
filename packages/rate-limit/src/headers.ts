/**
 * Serialization of a decision into the rate limit response fields of
 * draft-ietf-httpapi-ratelimit-headers-11, as RFC 9651 Lists of named policy Items,
 * plus the helper that writes them onto a response. Only reported numbers ship.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { SF } from "@sdxc/structured-fields";

import { toSeconds } from "@sdxc/duration";
import { isSuccess } from "@sdxc/result";
import { parse, stringify } from "@sdxc/structured-fields";

import type { RateLimitDecision } from "./types.js";

/** The current service limit under each policy: `r` remaining units and `t` seconds left. */
const RATE_LIMIT_FIELD = "RateLimit";

/** Each policy's quota: `q` units per `w` seconds, counted in `qu`. */
const RATE_LIMIT_POLICY_FIELD = "RateLimit-Policy";

/** Seconds to wait before retrying, sent only on a limited response. */
const RETRY_AFTER_FIELD = "Retry-After";

/** The fields that hold one Item per policy, so policies from several limiters share them. */
const POLICY_LIST_FIELDS = new Set([RATE_LIMIT_FIELD, RATE_LIMIT_POLICY_FIELD]);

/** The name a policy goes by when the caller gives it none. */
export const DEFAULT_POLICY_NAME = "default";

/**
 * What a policy's quota counts, from the draft's quota unit registry. A policy that
 * names none counts `"requests"`.
 */
export type QuotaUnit = "requests" | "content-bytes" | "concurrent-requests";

/**
 * The policy a decision is reported under. An `Adapter` is one already, with the
 * default name; spread it to name the policy or set a unit or partition key.
 */
export interface RateLimitPolicy {
	/** The counting window, written as `w` in whole seconds; under a second, `w` is left out. */
	window: DurationInput;
	/**
	 * Identifies the policy in both fields and in a `quota-exceeded` problem's
	 * `violated-policies`, so it is printable ASCII and stable across responses.
	 * @default "default"
	 */
	name?: string;
	/** Written as `qu` when given. */
	quotaUnit?: QuotaUnit;
	/**
	 * Written as `pk` on both fields, telling a client which budget the request spent.
	 * The client reads it as-is, so derive it from what the request already reveals.
	 */
	partitionKey?: Uint8Array;
}

/**
 * Serializes a decision into header name/value pairs: one `RateLimit` and one
 * `RateLimit-Policy` Item named after the policy, plus `Retry-After` only when the
 * attempt is denied. A field whose required value is unknown, or holds an Integer
 * beyond 15 digits, is left out.
 *
 * @param decision - The decision to describe.
 * @param policy - The policy it was made under; an `Adapter` fits.
 * @returns Header pairs in the order they should be written, possibly empty.
 *
 * @example
 * rateLimitHeaders(decision, adapter);
 * // [["RateLimit", '"default";r=0;t=7'], ["RateLimit-Policy", '"default";q=10;w=10'], ["Retry-After", "7"]]
 */
export function rateLimitHeaders(
	decision: RateLimitDecision,
	policy: RateLimitPolicy,
): [string, string][] {
	let entries: [string, string][] = [];
	let name = policy.name ?? DEFAULT_POLICY_NAME;
	let hasReset = Number.isFinite(decision.retryAfter) && decision.retryAfter >= 0;

	let remaining = availableQuota(decision);
	if (remaining !== null) {
		let params: SF.Parameters = { r: remaining };
		if (hasReset) params.t = decision.retryAfter;
		if (policy.partitionKey !== undefined) params.pk = policy.partitionKey;
		let field = stringify([{ value: name, params }], "list");
		if (isSuccess(field)) entries.push([RATE_LIMIT_FIELD, field.data]);
	}

	if (Number.isFinite(decision.limit)) {
		let params: SF.Parameters = { q: decision.limit };
		if (policy.quotaUnit !== undefined) params.qu = policy.quotaUnit;
		let windowSeconds = toSeconds(policy.window);
		if (Number.isFinite(windowSeconds) && windowSeconds > 0) params.w = windowSeconds;
		if (policy.partitionKey !== undefined) params.pk = policy.partitionKey;
		let field = stringify([{ value: name, params }], "list");
		if (isSuccess(field)) entries.push([RATE_LIMIT_POLICY_FIELD, field.data]);
	}

	if (!decision.allowed && hasReset) {
		entries.push([RETRY_AFTER_FIELD, String(decision.retryAfter)]);
	}

	return entries;
}

/**
 * The `r` a decision supports: the backend's count when it reports one, and `0` for a
 * denial, which is an exhausted budget whatever the backend could count.
 *
 * @param decision - The decision to describe.
 * @returns The remaining units, or `null` when nothing truthful can be said.
 */
function availableQuota(decision: RateLimitDecision): number | null {
	if (decision.remaining !== null && Number.isFinite(decision.remaining)) {
		return decision.remaining;
	}
	return decision.allowed ? null : 0;
}

/**
 * Writes the rate limit fields onto a response. Items for other policies already on it
 * stay, so nested limiters each report their own; an Item of the same name is replaced,
 * and `Retry-After` keeps the longer wait. A response whose headers reject mutation, as
 * platform-produced ones do, is answered with an equivalent copy.
 *
 * @param response - The response to annotate.
 * @param decision - The decision to describe.
 * @param policy - The policy it was made under; an `Adapter` fits.
 * @returns The same response, or an equivalent one carrying the headers.
 *
 * @example
 * return applyRateLimitHeaders(await next(), decision, adapter);
 */
export function applyRateLimitHeaders(
	response: Response,
	decision: RateLimitDecision,
	policy: RateLimitPolicy,
): Response {
	let entries = rateLimitHeaders(decision, policy).map(([name, value]): [string, string] => [
		name,
		mergeField(response.headers, name, value, policy.name ?? DEFAULT_POLICY_NAME),
	]);
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

/**
 * Combines a field value with the one already on the headers. A policy List keeps
 * every other policy's Item ahead of this one, and an invalid existing List is
 * dropped, as RFC 9651 has a recipient ignore it.
 *
 * @param headers - The response's current headers.
 * @param field - The field being written.
 * @param value - The value `rateLimitHeaders` produced for it.
 * @param policyName - The policy whose earlier Item the value replaces.
 * @returns The value to write.
 */
function mergeField(headers: Headers, field: string, value: string, policyName: string): string {
	let existing = headers.get(field);
	if (existing === null) return value;

	if (field === RETRY_AFTER_FIELD) {
		let earlier = /^\d+$/.test(existing.trim()) ? Number(existing) : Number.NaN;
		return earlier > Number(value) ? existing.trim() : value;
	}

	if (!POLICY_LIST_FIELDS.has(field)) return value;
	let list = parse(existing, "list");
	if (!isSuccess(list)) return value;
	let others = list.data.filter((member) => !("value" in member) || member.value !== policyName);
	let added = parse(value, "list");
	if (!isSuccess(added)) return value;
	let merged = stringify([...others, ...added.data], "list");
	return isSuccess(merged) ? merged.data : value;
}
