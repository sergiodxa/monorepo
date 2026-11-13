/**
 * The pricing estimate read from the home page's query: the monitors it lists, the Add and
 * Remove buttons a page without script submits, and the bill `config/pricing.ts` prices.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { estimateFromQuery, MAX_MONITORS } from "~/app/services/pricing-estimate";
import { BASE_PRICE_USD, monthlyCost } from "~/config/pricing";

describe("estimateFromQuery", () => {
	test("prices one monitor at the default interval when the query lists none", () => {
		let estimate = estimateFromQuery(new URLSearchParams());

		expect(estimate.intervals).toEqual([10]);
		expect(estimate.cost.totalUsd).toBe(BASE_PRICE_USD);
	});

	test("sums every monitor's pings and bills whole blocks over the included ones", () => {
		let estimate = estimateFromQuery(new URLSearchParams("m=1&m=1&m=5"));

		expect(estimate.intervals).toEqual([1, 1, 5]);
		expect(estimate.pings).toBe(40_320 * 2 + 8_064);
		expect(estimate.cost).toEqual(monthlyCost(88_704));
	});

	test("clamps intervals to the 1–60 minute range and drops values that are not numbers", () => {
		expect(estimateFromQuery(new URLSearchParams("m=0&m=900&m=x&m=7.4")).intervals).toEqual([
			1, 60, 7,
		]);
	});

	test("appends a default monitor for Add and drops the one at the position Remove names", () => {
		expect(estimateFromQuery(new URLSearchParams("m=30&m=5&add=")).intervals).toEqual([30, 5, 10]);
		expect(estimateFromQuery(new URLSearchParams("m=30&m=5&remove=0")).intervals).toEqual([5]);
	});

	test("keeps a crafted query to a bounded number of monitors", () => {
		let query = new URLSearchParams(Array.from({ length: 50 }, () => ["m", "5"]));

		expect(estimateFromQuery(query).intervals).toHaveLength(MAX_MONITORS);
	});
});
