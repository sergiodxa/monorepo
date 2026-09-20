/**
 * Exercises the rate card's own pure functions: `createCostQuantities` zeroing every
 * resource, and `priceCostQuantities` pricing a known quantity set to the cents the ADR's
 * own worked per-active-user-day table expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { COST_RESOURCES, createCostQuantities, priceCostQuantities, RATES } from "./cost-rates";

describe("createCostQuantities", () => {
	test("zeros every resource the rate card knows about", () => {
		let quantities = createCostQuantities();

		for (let resource of COST_RESOURCES) {
			expect(quantities[resource]).toBe(0);
		}

		expect(Object.keys(quantities).sort()).toEqual([...COST_RESOURCES].sort());
	});
});

describe("priceCostQuantities", () => {
	test("prices an empty set at zero", () => {
		expect(priceCostQuantities(createCostQuantities())).toBe(0);
	});

	test("prices a single resource at quantity times its own rate", () => {
		expect(priceCostQuantities({ doRowsWritten: 8 })).toBeCloseTo(8 * RATES.doRowsWritten, 12);
	});

	test("floors a negative quantity at zero rather than crediting the total", () => {
		expect(priceCostQuantities({ doRowsWritten: -5 })).toBe(0);
	});

	test("treats a resource missing from the input as zero", () => {
		expect(priceCostQuantities({})).toBe(0);
	});

	test("prices a modelled active-user-day the way the rate card's own worked table does", () => {
		// The per-active-user-day worked table: 8 Worker requests, 8 object requests at
		// ~20ms each, 10 rows read, 3 rows written directly plus 5 more from the audit
		// trail (priced together as one "rows written" quantity, since both are the same
		// resource under the same rate), 2 analytics points and 2 KV reads.
		let cents = priceCostQuantities({
			workerRequests: 8,
			workerCpuMs: 64,
			doRequests: 8,
			doDurationMs: 160,
			doRowsRead: 10,
			doRowsWritten: 8,
			analyticsPoints: 2,
			kvReads: 2,
		});

		expect(cents).toBeCloseTo(1.464e-3, 9);
	});
});
