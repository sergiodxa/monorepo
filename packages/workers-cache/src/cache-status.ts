/**
 * A typed read of the platform's cache status header, so a test can assert that
 * a route is actually cacheable and a log line can answer whether a deploy moved
 * hit rate, without string-matching a vendor header at each call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CacheStatus } from "./types.js";

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
