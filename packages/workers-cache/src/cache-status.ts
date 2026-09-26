/**
 * Typed reads of how caches treated a response: the platform's `cf-cache-status`
 * and the standard RFC 9211 `Cache-Status`, so tests and log lines check caching
 * without string-matching a header at each call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { getField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

import type { CacheForwardReason, CacheHop, CacheStatus } from "./types.js";

import { CACHE_STATUS_HEADER } from "./platform.js";

/**
 * Header values mapped onto the closed status set. Values that mean "served from
 * a stored entry that was no longer fresh" collapse onto `expired`, and values
 * that mean "the cache took no part" collapse onto `bypass`.
 */
const STATUS_BY_HEADER_VALUE: Record<string, CacheStatus> = {
	HIT: "hit",
	MISS: "miss",
	EXPIRED: "expired",
	STALE: "expired",
	REVALIDATED: "expired",
	UPDATING: "expired",
	BYPASS: "bypass",
	DYNAMIC: "bypass",
};

/**
 * Reads how the platform treated a response. A missing or unrecognized
 * header reads as `unknown` rather than being guessed at, so a log line
 * never mistakes an absent header for a miss.
 *
 * @param response - A response received from the platform edge.
 * @returns The normalized cache status.
 * @example
 * cacheStatus(response); // "hit"
 */
export function cacheStatus(response: Response): CacheStatus {
	let value = response.headers.get(CACHE_STATUS_HEADER);
	if (!value) return "unknown";
	return STATUS_BY_HEADER_VALUE[value.trim().toUpperCase()] ?? "unknown";
}

/** The RFC 9211 response field listing every cache a response passed through. */
const STANDARD_CACHE_STATUS_HEADER = "Cache-Status";

/** The forward reasons RFC 9211 section 2.2 defines; any other value invalidates the field. */
const FORWARD_REASONS: readonly CacheForwardReason[] = [
	"bypass",
	"method",
	"uri-miss",
	"vary-miss",
	"miss",
	"request",
	"stale",
	"partial",
];

/**
 * One `Cache-Status` member: the cache's identifier, a Token or a String, with the
 * parameters RFC 9211 defines. Extension parameters are dropped.
 */
const CACHE_HOP_SCHEMA = sf.item(
	s.union([sf.token(), s.string()]),
	s.object({
		hit: s.optional(s.boolean()),
		fwd: s.optional(sf.token(FORWARD_REASONS)),
		"fwd-status": s.optional(sf.integer()),
		ttl: s.optional(sf.integer()),
		stored: s.optional(s.boolean()),
		collapsed: s.optional(s.boolean()),
		key: s.optional(s.string()),
		detail: s.optional(s.union([sf.token(), s.string()])),
	}),
);

/**
 * Reads the caches a response passed through from RFC 9211 `Cache-Status`, in the
 * field's order: the cache closest to the origin first, the one nearest the client last.
 * An absent field, or one RFC 9651 or RFC 9211 rejects, reads as no hops, as the RFCs
 * have recipients ignore an invalid field.
 *
 * @param response - A response that may have passed through standards-speaking caches.
 * @returns One entry per cache, possibly empty.
 * @example
 * cacheHops(response); // [{ cache: "OriginCache", hit: true, ttl: 1100 }]
 */
export function cacheHops(response: Response): CacheHop[] {
	let field = getField(
		response.headers,
		STANDARD_CACHE_STATUS_HEADER,
		"list",
		s.array(CACHE_HOP_SCHEMA),
	);
	if (!isSuccess(field) || field.data === null) return [];
	return field.data.map(({ value, params }) => {
		let hop: CacheHop = { cache: value };
		if (params.hit !== undefined) hop.hit = params.hit;
		if (params.fwd !== undefined) hop.fwd = params.fwd;
		if (params["fwd-status"] !== undefined) hop.fwdStatus = params["fwd-status"];
		if (params.ttl !== undefined) hop.ttl = params.ttl;
		if (params.stored !== undefined) hop.stored = params.stored;
		if (params.collapsed !== undefined) hop.collapsed = params.collapsed;
		if (params.key !== undefined) hop.key = params.key;
		if (params.detail !== undefined) hop.detail = params.detail;
		return hop;
	});
}
