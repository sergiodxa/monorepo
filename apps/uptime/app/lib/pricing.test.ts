/**
 * Tests the pricing model: the monthly ping projection, the split between included
 * and metered usage, and the formatting helpers the English marketing copy quotes
 * these numbers through. The exact figures are asserted rather than derived from the
 * constants, so changing a price fails here first — the point being that a price
 * change is a deliberate edit with a visible diff, not something a helper silently
 * absorbs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	BASE_PRICE_USD,
	formatPings,
	formatUsd,
	INCLUDED_PINGS,
	monthlyCost,
	monthlyCostForUsage,
	monthlyPings,
	PINGS_PER_BLOCK,
	PRICE_PER_BLOCK_USD,
} from "./pricing";

describe("the pricing model", () => {
	test("charges $5 a month for the first 100,000 pings, then $1 per 10,000", () => {
		expect(BASE_PRICE_USD).toBe(5);
		expect(INCLUDED_PINGS).toBe(100_000);
		expect(PRICE_PER_BLOCK_USD).toBe(1);
		expect(PINGS_PER_BLOCK).toBe(10_000);
	});
});

describe("monthlyPings", () => {
	test("projects one check per interval per monitor over a 28-day month", () => {
		expect(monthlyPings({ monitors: 1, intervalMinutes: 1 })).toBe(40_320);
		expect(monthlyPings({ monitors: 1, intervalMinutes: 10 })).toBe(4_032);
		expect(monthlyPings({ monitors: 10, intervalMinutes: 30 })).toBe(13_440);
	});
});

describe("monthlyCost", () => {
	test("charges only the base price inside the included allowance", () => {
		let cost = monthlyCost(13_440);

		expect(cost.additionalPings).toBe(0);
		expect(cost.additionalCostUsd).toBe(0);
		expect(cost.totalUsd).toBe(5);
	});

	test("charges nothing extra at exactly the allowance", () => {
		expect(monthlyCost(INCLUDED_PINGS).totalUsd).toBe(5);
	});

	test("bills a single ping over the allowance as a whole block", () => {
		let cost = monthlyCost(INCLUDED_PINGS + 1);

		expect(cost.additionalPings).toBe(1);
		expect(cost.billedBlocks).toBe(1);
		expect(cost.totalUsd).toBe(6);
	});

	test("bills a ping past a full block as another whole block", () => {
		let cost = monthlyCost(110_001);

		expect(cost.additionalPings).toBe(10_001);
		expect(cost.billedBlocks).toBe(2);
		expect(cost.totalUsd).toBe(7);
	});

	test("charges nothing extra for the last ping of a block", () => {
		let cost = monthlyCost(INCLUDED_PINGS + 20_000);

		expect(cost.billedBlocks).toBe(2);
		expect(cost.totalUsd).toBe(7);
	});

	/**
	 * 3,000 over is three tenths of a block, and still costs a full dollar —
	 * dividing the block price by its size would understate this by $0.70.
	 */
	test("rounds a partial block up rather than prorating it", () => {
		let cost = monthlyCost(INCLUDED_PINGS + 3_000);

		expect(cost.additionalPings).toBe(3_000);
		expect(cost.billedBlocks).toBe(1);
		expect(cost.totalUsd).toBe(6);
	});

	/**
	 * 100 monitors every 5 minutes: 806,400 pings, 706,400 over the allowance,
	 * which is 70.64 blocks and therefore 71 of them.
	 */
	test("prices a heavy setup by whole blocks", () => {
		let cost = monthlyCostForUsage({ monitors: 100, intervalMinutes: 5 });

		expect(cost.additionalPings).toBe(706_400);
		expect(cost.billedBlocks).toBe(71);
		expect(cost.totalUsd).toBe(76);
	});

	test("never reports negative usage for a team under the allowance", () => {
		expect(monthlyCost(0)).toEqual({
			includedPings: INCLUDED_PINGS,
			additionalPings: 0,
			billedBlocks: 0,
			additionalCostUsd: 0,
			totalUsd: BASE_PRICE_USD,
		});
	});
});

describe("the English copy formatters", () => {
	test("drops the cents on whole dollar amounts and keeps them otherwise", () => {
		expect(formatUsd(5)).toBe("$5");
		expect(formatUsd(1)).toBe("$1");
		expect(formatUsd(5.3)).toBe("$5.30");
	});

	test("groups ping counts", () => {
		expect(formatPings(100_000)).toBe("100,000");
		expect(formatPings(10_000)).toBe("10,000");
	});

	/**
	 * These four are the only values `resources/content/marketing.ts` interpolates,
	 * matched against what `toLocaleString("en-US", …)` returned for them — including
	 * grouping past one separator, which no real input reaches yet.
	 */
	test("produces the exact strings the copy quoted before the formatters dropped Intl", () => {
		expect(formatUsd(BASE_PRICE_USD)).toBe("$5");
		expect(formatUsd(PRICE_PER_BLOCK_USD)).toBe("$1");
		expect(formatPings(INCLUDED_PINGS)).toBe("100,000");
		expect(formatPings(PINGS_PER_BLOCK)).toBe("10,000");

		expect(formatPings(1_234_567)).toBe("1,234,567");
		expect(formatUsd(1_234_567.5)).toBe("$1,234,567.50");
	});
});
