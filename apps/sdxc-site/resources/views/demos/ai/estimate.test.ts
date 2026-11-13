/**
 * Margin's calculator arithmetic: free hours come first, the volume rate applies only past
 * the first tier, only the long archive costs extra, and a malformed query falls back to
 * the defaults instead of failing the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	DEFAULT_HOURS,
	DEFAULT_RETENTION,
	estimate,
	formatCents,
	readEstimateInput,
} from "~/resources/views/demos/ai/estimate";

describe("estimate", () => {
	test("bills nothing for the free hours", () => {
		expect(estimate({ hours: 5, retention: "90-days" }).totalCents).toBe(0);
	});

	test("bills the first tier past the free hours", () => {
		let bill = estimate({ hours: 40, retention: "90-days" });
		expect(bill.totalCents).toBe(35 * 36);
		expect(bill.rows.map((row) => row.detail)).toEqual(["5 h × $0.00", "35 h × $0.36"]);
	});

	test("takes the volume rate only past 200 hours", () => {
		let bill = estimate({ hours: 250, retention: "notes-only" });
		expect(bill.totalCents).toBe(195 * 36 + 50 * 24);
		expect(bill.rows.at(-1)?.detail).toBe("50 h × $0.24");
	});

	test("adds the archive surcharge on billed hours only", () => {
		let bill = estimate({ hours: 40, retention: "2-years" });
		expect(bill.totalCents).toBe(35 * 36 + 35 * 4);
	});
});

describe("readEstimateInput", () => {
	test("reads hours and retention from the query", () => {
		expect(readEstimateInput(new URLSearchParams("hours=120&retention=notes-only"))).toEqual({
			hours: 120,
			retention: "notes-only",
		});
	});

	test("falls back to the defaults for missing or malformed fields", () => {
		for (let query of ["", "hours=-3&retention=forever", "hours=2.5", "hours=99999", "hours=abc"]) {
			expect(readEstimateInput(new URLSearchParams(query))).toEqual({
				hours: DEFAULT_HOURS,
				retention: DEFAULT_RETENTION,
			});
		}
	});
});

test("formats cents as dollars with separators", () => {
	expect(formatCents(123456)).toBe("$1,234.56");
});
