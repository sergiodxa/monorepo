/**
 * Tests for the shared price arithmetic: that a published "$X per N units" becomes the
 * right cents per unit, and that a GB-month storage price amortizes to a GB-day over the
 * 30-day billing month, so the dollars-to-cents and month-to-day steps are checked once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Meter } from "./meter.js";

import { centsPerGbDay, centsPerUnit, DAYS_PER_BILLING_MONTH } from "./meter.js";

describe("centsPerUnit", () => {
	test("divides the published USD amount by its quantity and converts to cents", () => {
		let meter: Meter<"request"> = {
			unit: "request",
			price: { usd: 0.3, per: 1_000_000 },
			included: null,
			freeLimit: null,
		};

		expect(centsPerUnit(meter)).toBeCloseTo(3e-5, 15);
	});

	test("prices a quantity of one as the published amount in cents", () => {
		let meter: Meter<"GB-month"> = {
			unit: "GB-month",
			price: { usd: 0.75, per: 1 },
			included: null,
			freeLimit: null,
		};

		expect(centsPerUnit(meter)).toBe(75);
	});
});

describe("centsPerGbDay", () => {
	test("amortizes a GB-month price over the 30-day billing month", () => {
		let meter: Meter<"GB-month"> = {
			unit: "GB-month",
			price: { usd: 0.75, per: 1 },
			included: null,
			freeLimit: null,
		};

		expect(DAYS_PER_BILLING_MONTH).toBe(30);
		expect(centsPerGbDay(meter)).toBeCloseTo(2.5, 12);
	});
});
