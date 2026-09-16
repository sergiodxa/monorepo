/**
 * Exercises the cadence a feed's own publishing rate earns it: the table of bands, the
 * dormant week a feed that published nothing falls to, the warm-up a feed serves while its
 * first document is all that has been measured, and the hysteresis that stops a rate
 * sitting on a boundary flapping between two schedules forever.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	POLL_DORMANT_MS,
	POLL_FLOOR_MS,
	POLL_WARMUP_INTERVAL_MS,
	POLL_WARMUP_MS,
	pollIntervalFor,
} from "~/database/feed-schema";

/** The epoch milliseconds every case is decided at, threaded rather than mocked. */
const NOW = 1_800_000_000_000;

/** One hour, the unit most of the table reads in. */
const HOUR = 60 * 60 * 1000;

/** A feed old enough that the warm-up has run out and its measurement is what decides. */
const SETTLED = NOW - 10 * 24 * HOUR;

/** The interval a settled feed measuring `rate` waits, with nothing measured before it. */
function intervalFor(rate: number): number {
	return pollIntervalFor(null, rate, SETTLED, NOW);
}

describe("the cadence table", () => {
	test("maps each band to the interval it names, at both of its edges", () => {
		expect(intervalFor(0.001)).toBe(24 * HOUR);
		expect(intervalFor(0.299)).toBe(24 * HOUR);

		expect(intervalFor(0.3)).toBe(12 * HOUR);
		expect(intervalFor(0.699)).toBe(12 * HOUR);

		expect(intervalFor(0.7)).toBe(4 * HOUR);
		expect(intervalFor(2.499)).toBe(4 * HOUR);

		expect(intervalFor(2.5)).toBe(HOUR);
		expect(intervalFor(9.999)).toBe(HOUR);

		expect(intervalFor(10)).toBe(POLL_FLOOR_MS);
		expect(intervalFor(200)).toBe(POLL_FLOOR_MS);
	});

	test("checks a weekly blog daily and a feed publishing twenty a day at the floor", () => {
		expect(intervalFor(1 / 7)).toBe(24 * HOUR);
		expect(intervalFor(20)).toBe(POLL_FLOOR_MS);
	});

	test("polls a feed that published nothing at the dormant week, and no other", () => {
		expect(intervalFor(0)).toBe(POLL_DORMANT_MS);
		expect(pollIntervalFor(null, null, SETTLED, NOW)).toBe(POLL_DORMANT_MS);

		// The window slides off a feed that stopped, so thirty days after its last entry a
		// dead feed measures zero with no liveness check and no flag anybody has to set —
		// and the smallest rate above it is a feed that is publishing something.
		expect(intervalFor(0.0001)).toBe(24 * HOUR);
	});
});

describe("hysteresis on a boundary", () => {
	test("moves to the faster band as soon as the rate crosses", () => {
		expect(pollIntervalFor(2, 3, SETTLED, NOW)).toBe(HOUR);
	});

	test("keeps the faster band while the rate stays above four fifths of the boundary", () => {
		expect(pollIntervalFor(3, 2, SETTLED, NOW)).toBe(HOUR);
	});

	test("lets the feed slow down once the rate falls below four fifths of it", () => {
		expect(pollIntervalFor(3, 1.9, SETTLED, NOW)).toBe(4 * HOUR);
	});

	test("re-arms one interval for a rate oscillating across a boundary", () => {
		// Speeding up costs a little money and slowing down costs a reader latency, so the
		// cheap error is the one made eagerly: both halves of the oscillation stay hourly.
		let previous = 3;
		let armed: number[] = [];

		for (let rate of [2, 3, 2, 3, 2]) {
			armed.push(pollIntervalFor(previous, rate, SETTLED, NOW));
			previous = rate;
		}

		expect(armed).toEqual([HOUR, HOUR, HOUR, HOUR, HOUR]);
	});
});

describe("a feed inside its first day", () => {
	test("polls hourly even when its measurement puts it slower", () => {
		// A document carries only a feed's newest entries, so truncation can only make it
		// look slower than it is, and slow is the expensive answer to be wrong about.
		expect(pollIntervalFor(null, 0.1, NOW, NOW)).toBe(POLL_WARMUP_INTERVAL_MS);
		expect(pollIntervalFor(null, 0, NOW, NOW)).toBe(POLL_WARMUP_INTERVAL_MS);
	});

	test("keeps a band already faster than the warm-up", () => {
		expect(pollIntervalFor(null, 12, NOW, NOW)).toBe(POLL_FLOOR_MS);
	});

	test("polls at its own band once the first day has run out", () => {
		expect(pollIntervalFor(null, 0.1, NOW - POLL_WARMUP_MS, NOW)).toBe(24 * HOUR);
		expect(pollIntervalFor(null, 0, NOW - POLL_WARMUP_MS, NOW)).toBe(POLL_DORMANT_MS);
	});
});
