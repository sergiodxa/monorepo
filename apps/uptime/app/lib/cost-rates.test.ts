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

import { describe, expect, test } from "bun:test";

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
	 * silently reinterprets every point already written — `double4` would stop meaning rows
	 * read. Appending is safe; this pins the prefix so a reorder fails here instead of
	 * quietly restating history.
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

		// The card's $0.90 per thousand. In dollars this would be 0.9; a 100× error here is
		// the one that would be hardest to notice downstream.
		expect(priceCostQuantities(quantities)).toBeCloseTo(90, 9);
	});

	/**
	 * ADR-002 §9's expected column for one successful HTTP check, whose per-resource usage
	 * was derived by hand from `EXPLAIN QUERY PLAN` and the platform's billing docs, totals
	 * $0.000034767 — `0.0034767` cents. Reproducing it from this card is what says the two
	 * documents describe the same system.
	 *
	 * To five decimals rather than more, because ADR-002's total is the sum of eleven lines
	 * each already rounded to nine decimal places in dollars. This card multiplies out
	 * exactly, so the two agree to 0.02% and not further — and it is the card, not the
	 * table, that is the arithmetic of record.
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
