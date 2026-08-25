/**
 * Unit tests for the rate card (ADR-007 §2). Three things are pinned: that the resource
 * list the Analytics Engine `double` positions are derived from stays append-only, that
 * pricing is in cents and not dollars, and that pricing one expected HTTP check reproduces
 * ADR-002 §9's independently-derived figure — the check that says the card's numbers are
 * the ones the cost model was built from rather than a plausible-looking transcription.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	COST_RESOURCES,
	createCostQuantities,
	MODELLED_CPU_MS,
	priceCostQuantities,
	RATES,
} from "./cost-rates";

describe("COST_RESOURCES", () => {
	test("positions every rate exactly once, in the rate card's own order", () => {
		expect(COST_RESOURCES.join(",")).toBe(Object.keys(RATES).join(","));
		expect(new Set(COST_RESOURCES).size).toBe(COST_RESOURCES.length);
	});

	/**
	 * A recorded data point positions its quantities by this list's index, so reordering it
	 * silently reinterprets every point already written — `double4` would stop meaning what it
	 * once read. This pins the prefix, keeping appends the only safe change.
	 */
	test("keeps the prefix every already-written data point was positioned by", () => {
		expect(COST_RESOURCES.slice(0, 6)).toEqual([
			"workerRequest",
			"workerCpuMs",
			"queueOperation",
			"d1RowRead",
			"d1RowWritten",
			"d1StorageGbDay",
		]);
	});

	test("fits inside the twenty doubles a data point carries, with the total alongside", () => {
		expect(COST_RESOURCES.length + 1).toBeLessThanOrEqual(20);
	});
});

describe("createCostQuantities", () => {
	test("starts every resource at zero, so pricing is a plain sum", () => {
		let quantities = createCostQuantities();

		expect(Object.keys(quantities)).toEqual([...COST_RESOURCES]);
		expect(priceCostQuantities(quantities)).toBe(0);
	});
});

describe("priceCostQuantities", () => {
	test("prices in cents, not dollars", () => {
		let quantities = createCostQuantities();
		quantities.emailSent = 1_000;

		expect(priceCostQuantities(quantities)).toBeCloseTo(35, 9);
	});

	/**
	 * ADR-002 §9's expected column for one successful HTTP check totals $0.000034767
	 * (`0.0034767` cents), hand-derived from `EXPLAIN QUERY PLAN` and the billing docs.
	 * Matching it to five decimals — ADR-002's own rounding precision — confirms this card prices the same system.
	 */
	test("reproduces ADR-002's expected cost for one successful HTTP check", () => {
		let quantities = createCostQuantities();
		quantities.workerRequest = 0.9;
		quantities.workerCpuMs = 6;
		quantities.queueOperation = 6;
		quantities.d1RowRead = 20_180;
		quantities.d1RowWritten = 10;
		quantities.doRequest = 1;
		quantities.doDurationMs = 250;
		quantities.aeDataPoint = 1;
		quantities.aeQuery = 1;

		expect(priceCostQuantities(quantities)).toBeCloseTo(0.0034767, 5);
	});
});

describe("MODELLED_CPU_MS", () => {
	test("bands every handler class, since nothing measures CPU at runtime", () => {
		expect(Object.keys(MODELLED_CPU_MS).sort()).toEqual(["fetch", "queue", "scheduled"]);
	});
});
