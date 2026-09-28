/**
 * Unit tests for the rate card: the `double` positions stay append-only, pricing is in
 * cents, each rate the card corrected prices as Cloudflare bills it, and one expected HTTP
 * check still reproduces ADR-002 §9's independently derived figure, adjusted for those corrections.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as AnalyticsEngine from "@sdxc/cloudflare-pricing/analytics-engine";
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
		expect(COST_RESOURCES.slice(0, 18)).toEqual([
			"workerRequest",
			"workerCpuMs",
			"queueOperation",
			"d1RowRead",
			"d1RowWritten",
			"d1StorageGbDay",
			"kvRead",
			"kvMutation",
			"kvStorageGbDay",
			"doRequest",
			"doDurationMs",
			"aeDataPoint",
			"aeQuery",
			"emailSent",
			"doSqliteStorageGbDay",
			"doRowRead",
			"doRowWritten",
			"workerLogEvent",
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
	 * ADR-002 §9's expected column for one successful HTTP check totals `0.0034767` cents,
	 * hand-derived from `EXPLAIN QUERY PLAN` and the billing docs under the previous card.
	 * This card prices the same check at that figure less Analytics Engine's unbilled share,
	 * plus duration repriced at 0.128 GB, to five decimals, ADR-002's own precision.
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

		let analyticsEngineCents = 1 * 2.5e-5 + 1 * 1.0e-4;
		let durationCorrectionCents = 250 * (1.6e-7 - 1.5625e-7);

		expect(priceCostQuantities(quantities)).toBeCloseTo(
			0.0034767 - analyticsEngineCents + durationCorrectionCents,
			5,
		);
	});
});

describe("RATES", () => {
	/**
	 * Regression: Durable Object duration was priced with 128 MB as 0.125 GB, 2.3% under the
	 * bill. $12.50 per million GB-s at 0.128 GB is 1.6e-7 cents per active millisecond.
	 */
	test("prices Durable Object duration at the 0.128 GB Cloudflare bills", () => {
		expect(RATES.doDurationMs).toBeCloseTo(1.6e-7, 15);
	});

	test("prices Analytics Engine at zero while Cloudflare does not invoice it", () => {
		expect(AnalyticsEngine.BILLING_ACTIVE).toBe(false);
		expect(RATES.aeDataPoint).toBe(0);
		expect(RATES.aeQuery).toBe(0);
	});

	test("prices a Workers Logs event at $0.60 per million", () => {
		expect(RATES.workerLogEvent).toBeCloseTo(6.0e-5, 15);
	});

	test("keeps every rate the previous card stated correctly", () => {
		expect(RATES.workerRequest).toBeCloseTo(3.0e-5, 15);
		expect(RATES.workerCpuMs).toBeCloseTo(2.0e-6, 15);
		expect(RATES.queueOperation).toBeCloseTo(4.0e-5, 15);
		expect(RATES.d1RowRead).toBeCloseTo(1.0e-7, 15);
		expect(RATES.d1RowWritten).toBeCloseTo(1.0e-4, 15);
		expect(RATES.d1StorageGbDay).toBeCloseTo(2.5, 12);
		expect(RATES.kvRead).toBeCloseTo(5.0e-5, 15);
		expect(RATES.kvMutation).toBeCloseTo(5.0e-4, 15);
		expect(RATES.kvStorageGbDay).toBeCloseTo(1.667, 3);
		expect(RATES.doRequest).toBeCloseTo(1.5e-5, 15);
		expect(RATES.emailSent).toBeCloseTo(3.5e-2, 12);
		expect(RATES.doSqliteStorageGbDay).toBeCloseTo(0.667, 3);
		expect(RATES.doRowRead).toBeCloseTo(1.0e-7, 15);
		expect(RATES.doRowWritten).toBeCloseTo(1.0e-4, 15);
	});
});

describe("MODELLED_CPU_MS", () => {
	test("bands every handler class, since nothing measures CPU at runtime", () => {
		expect(Object.keys(MODELLED_CPU_MS).sort()).toEqual(["fetch", "queue", "scheduled"]);
	});
});
