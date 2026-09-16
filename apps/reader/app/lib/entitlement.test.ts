/**
 * The tier rules, driven without a platform, a database or a clock. Every lapse decision
 * this app makes is one call to `effectiveTier`, so the sequence a reader lives through —
 * a failed card, a fortnight, a payment or a drop — is asserted here as arithmetic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	DEFAULT_TIER,
	effectiveTier,
	entitledTier,
	GRACE_PERIOD_MS,
	limitRefusal,
	limitsOf,
	overBy,
	TIER_LIMITS,
	TIER_PRODUCTS,
	TIERS,
	tierForProducts,
	tierRank,
	withinLimit,
} from "~/app/lib/entitlement";

/** A fixed moment, so every window below is read off one number rather than a clock. */
const NOW = 1_800_000_000_000;

describe("the tier table", () => {
	test("every tier allows at least as much as the one below it", () => {
		for (let [lower, higher] of [
			["free", "paid"],
			["paid", "premium"],
		] as const) {
			expect(limitsOf(higher).feeds).toBeGreaterThan(limitsOf(lower).feeds);
			expect(limitsOf(higher).saved).toBeGreaterThanOrEqual(limitsOf(lower).saved);
			expect(tierRank(higher)).toBeGreaterThan(tierRank(lower));
		}
	});

	test("the free tier arms no background check and bounds its search", () => {
		expect(TIER_LIMITS.free.checkIntervalMs).toBeNull();
		expect(TIER_LIMITS.free.searchWindowDays).toBe(30);
		expect(TIER_LIMITS.paid.searchWindowDays).toBeNull();
		expect(TIER_LIMITS.premium.searchWindowDays).toBeNull();
	});

	test("a reader holding nothing this app sells is on the free tier", () => {
		expect(tierForProducts([])).toBe(DEFAULT_TIER);
		expect(tierForProducts(["something-else", null])).toBe(DEFAULT_TIER);
	});

	test("holding both products answers the higher of them", () => {
		expect(tierForProducts([TIER_PRODUCTS.paid, TIER_PRODUCTS.premium])).toBe("premium");
		expect(tierForProducts([TIER_PRODUCTS.paid])).toBe("paid");
	});

	test("a subscription the platform has not settled grants nothing by itself", () => {
		let held = [{ productSlug: TIER_PRODUCTS.premium, status: "past_due" }];

		expect(entitledTier(held)).toBe("free");
		expect(entitledTier([{ productSlug: TIER_PRODUCTS.premium, status: "active" }])).toBe(
			"premium",
		);
	});

	test("a limit refuses at the allowance rather than one past it", () => {
		expect(withinLimit("free", "feeds", TIER_LIMITS.free.feeds - 1)).toBe(true);
		expect(withinLimit("free", "feeds", TIER_LIMITS.free.feeds)).toBe(false);

		let refused = limitRefusal("free", "feeds", 400);

		expect(refused).toEqual({
			limit: "feeds",
			current: 400,
			allowed: TIER_LIMITS.free.feeds,
			tier: "free",
		});
		expect(overBy(refused)).toBe(400 - TIER_LIMITS.free.feeds);
		expect(overBy(limitRefusal("free", "feeds", 2))).toBe(0);
	});
});

describe("effectiveTier", () => {
	test("an upgrade takes effect at once, with no grace period in the way", () => {
		let decided = effectiveTier(
			{ entitled: "premium", cancelled: false },
			{ tier: "free", graceUntil: null },
			NOW,
		);

		expect(decided).toEqual({ tier: "premium", graceUntil: null });
	});

	test("a first lapsed snapshot opens a fortnight and moves no tier", () => {
		let decided = effectiveTier(
			{ entitled: "free", cancelled: false },
			{ tier: "paid", graceUntil: null },
			NOW,
		);

		expect(decided).toEqual({ tier: "paid", graceUntil: NOW + GRACE_PERIOD_MS });
	});

	test("a payment inside the window clears it and changes nothing else", () => {
		let decided = effectiveTier(
			{ entitled: "paid", cancelled: false },
			{ tier: "paid", graceUntil: NOW + GRACE_PERIOD_MS },
			NOW + 1000,
		);

		expect(decided).toEqual({ tier: "paid", graceUntil: null });
	});

	test("a second lapsed snapshot inside the window leaves the window where it was", () => {
		let opened = NOW + GRACE_PERIOD_MS;

		let decided = effectiveTier(
			{ entitled: "free", cancelled: false },
			{ tier: "paid", graceUntil: opened },
			NOW + 7 * 24 * 60 * 60 * 1000,
		);

		expect(decided).toEqual({ tier: "paid", graceUntil: opened });
	});

	test("the tier drops once the window has passed, to what the snapshot says", () => {
		let opened = NOW + GRACE_PERIOD_MS;

		let decided = effectiveTier(
			{ entitled: "free", cancelled: false },
			{ tier: "premium", graceUntil: opened },
			opened + 1,
		);

		expect(decided).toEqual({ tier: "free", graceUntil: null });
	});

	test("a cancellation the reader asked for drops with no grace period", () => {
		let decided = effectiveTier(
			{ entitled: "free", cancelled: true },
			{ tier: "paid", graceUntil: null },
			NOW,
		);

		expect(decided).toEqual({ tier: "free", graceUntil: null });
	});

	test("a snapshot that agrees with the stored tier clears a window it finds open", () => {
		for (let tier of TIERS) {
			expect(
				effectiveTier({ entitled: tier, cancelled: false }, { tier, graceUntil: NOW }, NOW),
			).toEqual({ tier, graceUntil: null });
		}
	});
});
