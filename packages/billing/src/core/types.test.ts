/**
 * Tests the currency table, which is what keeps minor-unit precision derived
 * rather than assumed: a provider that hardcodes two decimals prices a yen
 * product a hundred times over, and this is where that shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { minorUnitDigits } from "./types.js";

describe("minorUnitDigits", () => {
	test("reports two decimals for the currencies that have them", () => {
		expect(minorUnitDigits("usd")).toBe(2);
		expect(minorUnitDigits("eur")).toBe(2);
	});

	test("reports no decimals for a currency with no minor unit", () => {
		expect(minorUnitDigits("jpy")).toBe(0);
		expect(minorUnitDigits("clp")).toBe(0);
	});

	test("reports three decimals for the currencies that have them", () => {
		expect(minorUnitDigits("bhd")).toBe(3);
		expect(minorUnitDigits("kwd")).toBe(3);
	});

	test("answers the same for an uppercase code, as a platform may spell it", () => {
		expect(minorUnitDigits("JPY")).toBe(0);
		expect(minorUnitDigits("KWD")).toBe(3);
	});

	test("falls back to two decimals for a code outside the table", () => {
		expect(minorUnitDigits("zzz")).toBe(2);
	});
});
