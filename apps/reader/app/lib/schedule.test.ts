/**
 * Drives the arithmetic a wake is scheduled by, which is decidable from its arguments
 * alone: what a tier buys, what being away costs, and where inside an interval one
 * reader's wakes land.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	ACTIVE_MULTIPLIER,
	checkIntervalFor,
	DEEPLY_DORMANT_AFTER_MS,
	DEEPLY_DORMANT_MULTIPLIER,
	DORMANT_AFTER_MS,
	DORMANT_MULTIPLIER,
	dormancyMultiplier,
	earliestDue,
	nextCheckAt,
	phaseOffset,
} from "~/app/lib/schedule";

/** A fixed moment every interval below is measured from. */
const NOW = 1_800_000_000_000;

/** What the paid tier buys, which is the coarsest interval a reader cannot notice. */
const PAID_MS = 30 * 60 * 1000;

/** What the premium tier buys, which is the floor worth offering. */
const PREMIUM_MS = 5 * 60 * 1000;

describe("what a tier buys", () => {
	test("free is no schedule rather than a slow one", () => {
		expect(checkIntervalFor("free", NOW, NOW)).toBeNull();
	});

	test("paid and premium each check on their own interval", () => {
		expect(checkIntervalFor("paid", NOW, NOW)).toBe(PAID_MS);
		expect(checkIntervalFor("premium", NOW, NOW)).toBe(PREMIUM_MS);
	});
});

describe("the dormancy ladder", () => {
	test("an account opened today is on the interval it pays for", () => {
		expect(dormancyMultiplier(NOW - 1000, NOW)).toBe(ACTIVE_MULTIPLIER);
		expect(checkIntervalFor("paid", NOW - 1000, NOW)).toBe(PAID_MS);
	});

	test("an account a month without an open backs off one rung", () => {
		let lastOpened = NOW - DORMANT_AFTER_MS;

		expect(dormancyMultiplier(lastOpened, NOW)).toBe(DORMANT_MULTIPLIER);
		expect(checkIntervalFor("premium", lastOpened, NOW)).toBe(PREMIUM_MS * DORMANT_MULTIPLIER);
	});

	test("an account past ninety days checks on the slowest rung and no faster", () => {
		let lastOpened = NOW - DEEPLY_DORMANT_AFTER_MS * 4;

		expect(dormancyMultiplier(lastOpened, NOW)).toBe(DEEPLY_DORMANT_MULTIPLIER);
		expect(checkIntervalFor("paid", lastOpened, NOW)).toBe(PAID_MS * DEEPLY_DORMANT_MULTIPLIER);
	});

	test("an open resets the ladder to the interval the tier sells", () => {
		expect(checkIntervalFor("paid", NOW, NOW)).toBe(PAID_MS);
	});

	test("a reader with no open recorded reads as active", () => {
		expect(dormancyMultiplier(null, NOW)).toBe(ACTIVE_MULTIPLIER);
	});

	test("free stays unscheduled however long the reader has been away", () => {
		expect(checkIntervalFor("free", NOW - DEEPLY_DORMANT_AFTER_MS, NOW)).toBeNull();
	});
});

describe("the phase a reader's wakes land on", () => {
	test("two subjects on one tier take different phases", () => {
		let first = phaseOffset("sub-first", PAID_MS);
		let second = phaseOffset("sub-second", PAID_MS);

		expect(first).not.toBe(second);
	});

	test("a subject's phase is the same every time it is derived", () => {
		expect(phaseOffset("sub-stable", PAID_MS)).toBe(phaseOffset("sub-stable", PAID_MS));
	});

	test("a phase stays inside the interval it spreads wakes across", () => {
		for (let index = 0; index < 50; index++) {
			let phase = phaseOffset(`sub-${index}`, PREMIUM_MS);

			expect(phase).toBeGreaterThanOrEqual(0);
			expect(phase).toBeLessThan(PREMIUM_MS);
		}
	});

	test("subjects spread across the interval rather than sharing one second of it", () => {
		let phases = new Set(
			Array.from({ length: 100 }, (_value, index) => phaseOffset(`sub-${index}`, PAID_MS)),
		);

		expect(phases.size).toBeGreaterThan(90);
	});
});

describe("the next wake", () => {
	test("lands within one interval, strictly after the moment it is scheduled from", () => {
		let next = nextCheckAt("sub-next", PAID_MS, NOW);

		expect(next).toBeGreaterThan(NOW);
		expect(next).toBeLessThanOrEqual(NOW + PAID_MS);
	});

	test("answers the same moment whenever it is recomputed inside the interval", () => {
		let next = nextCheckAt("sub-grid", PAID_MS, NOW);

		expect(nextCheckAt("sub-grid", PAID_MS, NOW + 1000)).toBe(next);
		expect(nextCheckAt("sub-grid", PAID_MS, next - 1)).toBe(next);
	});

	test("moves on by exactly one interval once the wake it named has passed", () => {
		let next = nextCheckAt("sub-grid", PAID_MS, NOW);

		expect(nextCheckAt("sub-grid", PAID_MS, next)).toBe(next + PAID_MS);
	});

	test("lands on the reader's own phase, so two readers wake at different moments", () => {
		expect(nextCheckAt("sub-first", PAID_MS, NOW)).not.toBe(
			nextCheckAt("sub-second", PAID_MS, NOW),
		);
	});
});

describe("where the single alarm goes", () => {
	test("the earliest due time wins, whichever job holds it", () => {
		expect(earliestDue([NOW + 1000, NOW + 10, NOW + 500])).toBe(NOW + 10);
	});

	test("a job with no due time is not a wake", () => {
		expect(earliestDue([null, NOW + 10])).toBe(NOW + 10);
		expect(earliestDue([null, null, null])).toBeNull();
	});
});
