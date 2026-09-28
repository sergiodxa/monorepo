/**
 * Exercises the rate card: every rate matching Cloudflare's list price, `createCostQuantities`
 * zeroing every resource, and `priceCostQuantities` pricing a known quantity set to the cents
 * the worked per-active-user-day table expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { COST_RESOURCES, createCostQuantities, priceCostQuantities, RATES } from "./cost-rates";

describe("RATES", () => {
	test("prices a GB-day of D1 storage at 2.5 cents, from $0.75 per GB-month", () => {
		expect(RATES.d1StorageGbDays).toBeCloseTo(2.5, 12);
	});

	test("prices a GB-day of KV storage at 1.667 cents, from $0.50 per GB-month", () => {
		expect(RATES.kvStorageGbDays).toBeCloseTo(1.667, 3);
	});

	test("prices a D1 row read at the read rate, a thousandth of a written row", () => {
		expect(RATES.d1RowsRead).toBeCloseTo(1.0e-7, 15);
		expect(RATES.d1RowsWritten).toBeCloseTo(1.0e-4, 15);
	});

	test("prices a Durable Object's active millisecond at 128 MB billed as 0.128 GB", () => {
		expect(RATES.doDurationMs).toBeCloseTo(1.6e-7, 15);
	});

	test("prices R2 Standard operations and Workers Logs events", () => {
		expect(RATES.r2ClassAOperations).toBeCloseTo(4.5e-4, 15);
		expect(RATES.r2ClassBOperations).toBeCloseTo(3.6e-5, 15);
		expect(RATES.workerLogEvents).toBeCloseTo(6.0e-5, 15);
	});

	test("prices Analytics Engine at zero while Cloudflare does not invoice it", () => {
		expect(RATES.analyticsPoints).toBe(0);
		expect(RATES.analyticsQueries).toBe(0);
	});

	test("prices the retired d1Rows meter at zero", () => {
		expect(RATES.d1Rows).toBe(0);
	});
});

describe("COST_RESOURCES", () => {
	test("keeps every resource at the position already recorded measurements use", () => {
		expect(COST_RESOURCES.slice(0, 16)).toEqual([
			"workerRequests",
			"workerCpuMs",
			"doRequests",
			"doDurationMs",
			"doRowsRead",
			"doRowsWritten",
			"doStorageGbDays",
			"d1Rows",
			"d1StorageGbDays",
			"kvReads",
			"kvMutations",
			"kvStorageGbDays",
			"analyticsPoints",
			"analyticsQueries",
			"queueOperations",
			"emailSent",
		]);
	});
});

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

	/**
	 * 8 Worker requests, 8 object requests at ~20ms each, 10 rows read, 3 rows written plus 5
	 * from the audit trail, 2 unbilled analytics points and 2 KV reads.
	 */
	test("prices a modelled active-user-day the way the rate card's own worked table does", () => {
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

		expect(cents).toBeCloseTo(1.4146e-3, 9);
	});
});
