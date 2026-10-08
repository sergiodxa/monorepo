/**
 * Which remote origins have been failing deliveries, kept in the app's cache so fan-out
 * stops queueing work for a server that has been down for days, and so one inbound
 * activity that verifies from that server makes it reachable again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Cache } from "@sdxc/cache";

import { toMs } from "@sdxc/duration";
import { isFailure } from "@sdxc/result";

/** Failures lasting longer than this make an origin unavailable, the window Mastodon uses. */
export const UNAVAILABLE_AFTER = toMs("7 days");

/** Outlives the window, so a failing origin is still remembered when it crosses it. */
const RECORD_TTL = "30 days";

/** The first failure seen since the origin last succeeded. */
interface FailureRecord {
	since: number;
}

/** One entry per origin, so every inbox on a server shares its standing. */
function keyOf(origin: string): string {
	return `activitypub:unavailable:${origin}`;
}

/**
 * Records a failed delivery to `origin`. The first failure starts the window and later
 * ones keep it, so the window measures how long the origin has been failing.
 *
 * @param cache - The app's cache.
 * @param origin - The origin of the inbox that failed.
 * @param now - The current time in milliseconds.
 */
export async function recordFailure(cache: Cache, origin: string, now = Date.now()): Promise<void> {
	let current = await cache.read<FailureRecord>(keyOf(origin));
	if (isFailure(current)) return;
	if (current.data !== null && typeof current.data.since === "number") return;
	await cache.write<FailureRecord>(keyOf(origin), { since: now }, { ttl: RECORD_TTL });
}

/**
 * Clears the failure window of `origin`, after a delivery succeeded or an activity from it
 * verified. A cache failure leaves the record, which costs at most a skipped delivery.
 *
 * @param cache - The app's cache.
 * @param origin - The origin that answered.
 */
export async function recordSuccess(cache: Cache, origin: string): Promise<void> {
	await cache.delete(keyOf(origin));
}

/**
 * Whether `origin` has been failing for longer than {@link UNAVAILABLE_AFTER}. A cache
 * failure reads as available, so a broken cache never stops delivery.
 *
 * @param cache - The app's cache.
 * @param origin - The origin about to receive a delivery.
 * @param now - The current time in milliseconds.
 */
export async function isUnavailable(
	cache: Cache,
	origin: string,
	now = Date.now(),
): Promise<boolean> {
	let current = await cache.read<FailureRecord>(keyOf(origin));
	if (isFailure(current) || current.data === null) return false;
	if (typeof current.data.since !== "number") return false;
	return now - current.data.since > UNAVAILABLE_AFTER;
}
