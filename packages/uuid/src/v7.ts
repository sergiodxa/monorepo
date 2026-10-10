/**
 * Time-ordered UUID generation: version 7 values whose string order follows the order they
 * were generated in, including several in the same millisecond, so primary keys append to
 * their index and an id alone can page a listing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UUID } from "./index.js";

import { assertUUID } from "./index.js";

/** Largest value the 12-bit `rand_a` counter holds before the timestamp has to advance. */
const COUNTER_MAX = 0xfff;

/**
 * The last timestamp written and the counter beside it, shared by every call in the isolate.
 * Keeping the timestamp from going backwards is what makes each value sort after the last.
 */
const CLOCK = { timestamp: -1, counter: 0 };

/**
 * Generates a version 7 UUID (RFC 9562): a 48-bit Unix millisecond timestamp, a 12-bit
 * counter that increments within a millisecond, and 62 random bits. Each value sorts after
 * the previous one from the same isolate, even while `Date.now()` stays put.
 *
 * @returns A UUIDv7, narrowed to {@link UUID}.
 * @example
 * let first = generateUUID();
 * let second = generateUUID();
 * first < second; // true
 */
export function generateUUID(): UUID {
	advance(Date.now());

	let random = crypto.getRandomValues(new Uint8Array(8));
	let bytes = new Uint8Array(16);
	let timestamp = CLOCK.timestamp;

	for (let index = 5; index >= 0; index--) {
		bytes[index] = timestamp % 256;
		timestamp = Math.floor(timestamp / 256);
	}

	bytes[6] = 0x70 | (CLOCK.counter >> 8);
	bytes[7] = CLOCK.counter & 0xff;
	bytes[8] = 0x80 | (random[0]! & 0x3f);
	bytes.set(random.subarray(1), 9);

	let id = format(bytes);
	assertUUID(id);
	return id;
}

/**
 * Moves the clock to `now`, or past the last timestamp when `now` is not later than it.
 * A new millisecond seeds the counter randomly below its midpoint, leaving at least 2048
 * increments; exhausting them moves the timestamp one millisecond ahead, as RFC 9562 allows.
 *
 * @param now Current Unix time in milliseconds.
 */
function advance(now: number) {
	if (now > CLOCK.timestamp) {
		CLOCK.timestamp = now;
		CLOCK.counter = seed();
		return;
	}

	CLOCK.counter++;
	if (CLOCK.counter <= COUNTER_MAX) return;

	CLOCK.timestamp++;
	CLOCK.counter = seed();
}

/**
 * Picks a random starting counter with its top bit clear, so the first value of a
 * millisecond is unpredictable and still leaves half the counter's range to increment into.
 *
 * @returns An integer in `[0, 0x7ff]`.
 */
function seed() {
	let [value] = crypto.getRandomValues(new Uint16Array(1));
	return value! & 0x7ff;
}

/**
 * Writes 16 bytes as the canonical lowercase `8-4-4-4-12` UUID string.
 *
 * @param bytes The UUID's bytes in network order.
 * @returns The hyphenated hex form.
 */
function format(bytes: Uint8Array) {
	let hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
