/**
 * Turns the TTL a caller writes into the whole seconds a store counts, so a
 * number and a duration string produce the same expiry and every adapter
 * measures a lifetime the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";

import { toSeconds } from "@sdxc/duration";

/**
 * A bare number passes through unchanged, so a numeric call site keeps its exact
 * expiry, and a duration string converts, so `3600` and `"1 hour"` agree.
 *
 * @param ttl How long the entry stays readable, or `undefined` for no expiry.
 * @returns Whole seconds, or `undefined` when the entry never expires.
 */
export function ttlSeconds(ttl: DurationInput | undefined): number | undefined {
	if (ttl === undefined) return undefined;
	if (typeof ttl === "number") return ttl;
	return toSeconds(ttl);
}
