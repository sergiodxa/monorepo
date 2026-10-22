/**
 * Tests for the rate card: that its resource order is the order the rates were written in,
 * that `zero()` hands out a fresh fully-zeroed set, and that `price()` sums every line as
 * `max(0, units) × rate` with missing resources at zero.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vite-plus/test";

import type { RateCardQuantities, RateCardResource } from "./rate-card.js";

import { defineRateCard } from "./rate-card.js";

/** A small card whose keys are deliberately out of alphabetical order. */
const CARD = defineRateCard({ writes: 0.5, reads: 0.25, storage: 2 });

describe("defineRateCard", () => {
	test("lists resources in the order the rates were written in", () => {
		expect(CARD.resources).toEqual(["writes", "reads", "storage"]);
	});

	test("keeps the rates as written", () => {
		expect(CARD.rates).toEqual({ writes: 0.5, reads: 0.25, storage: 2 });
	});

	test("freezes the card, its resources and its rates", () => {
		expect(Object.isFrozen(CARD)).toBe(true);
		expect(Object.isFrozen(CARD.resources)).toBe(true);
		expect(Object.isFrozen(CARD.rates)).toBe(true);
	});

	test("types the resource names from the keys", () => {
		expectTypeOf<RateCardResource<typeof CARD>>().toEqualTypeOf<"writes" | "reads" | "storage">();
		expectTypeOf(CARD.zero()).toEqualTypeOf<RateCardQuantities<"writes" | "reads" | "storage">>();
	});
});

describe("zero", () => {
	test("sets every resource to zero, keyed in resource order", () => {
		let quantities = CARD.zero();

		expect(quantities).toEqual({ writes: 0, reads: 0, storage: 0 });
		expect(Object.keys(quantities)).toEqual([...CARD.resources]);
	});

	test("returns a fresh object on every call", () => {
		let first = CARD.zero();
		first.writes += 3;

		expect(CARD.zero().writes).toBe(0);
	});
});

describe("price", () => {
	test("sums units times rate across every resource", () => {
		expect(CARD.price({ writes: 4, reads: 8, storage: 1.5 })).toBeCloseTo(7, 12);
	});

	test("prices a missing resource at zero", () => {
		expect(CARD.price({ reads: 4 })).toBe(1);
		expect(CARD.price({})).toBe(0);
	});

	test("prices a negative quantity at zero rather than crediting the total", () => {
		expect(CARD.price({ writes: -10, reads: 4 })).toBe(1);
	});

	test("prices a zeroed set at zero", () => {
		expect(CARD.price(CARD.zero())).toBe(0);
	});
});
