/**
 * Holds the money helpers to their promise: every currency's own precision, typed amounts
 * read per locale, shares and percentages that never lose a cent, conversion rounded to the
 * target's minor unit, and formatting with a true minus and a statement-style sign.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	allocate,
	amountParts,
	convert,
	currencyExponent,
	formatAmount,
	parseAmount,
	percentOf,
	sumByCurrency,
	toMajor,
	toMinor,
} from "./index.js";

describe("currency precision", () => {
	test("reads each currency's minor digits from Intl", () => {
		expect(currencyExponent("EUR")).toBe(2);
		expect(currencyExponent("JPY")).toBe(0);
		expect(currencyExponent("BHD")).toBe(3);
	});

	test("moves between major and minor units without float drift", () => {
		expect(toMinor(19.99, "EUR")).toBe(1999);
		expect(toMinor(1.005, "EUR")).toBe(101);
		expect(toMinor(-12.345, "EUR")).toBe(-1235);
		expect(toMinor(1250.4, "JPY")).toBe(1250);
		expect(toMajor(1250, "EUR")).toBe(12.5);
		expect(toMajor(1234, "BHD")).toBe(1.234);
	});
});

describe("parseAmount", () => {
	test("reads English amounts with grouping, symbols and codes", () => {
		expect(parseAmount("1,204.50", "EUR")).toBe(120450);
		expect(parseAmount("€ 30", "EUR")).toBe(3000);
		expect(parseAmount("12.5", "EUR")).toBe(1250);
		expect(parseAmount(".5", "EUR")).toBe(50);
		expect(parseAmount("USD 1,000", "USD")).toBe(100000);
		expect(parseAmount("500", "JPY")).toBe(500);
	});

	test("reads a locale's own decimal and grouping marks", () => {
		expect(parseAmount("1.204,50 €", "EUR", { locale: "de-DE" })).toBe(120450);
		expect(parseAmount("1 204,50", "EUR", { locale: "fr-FR" })).toBe(120450);
		expect(parseAmount("1.204,50", "EUR")).toBeNull();
	});

	test("refuses anything that is not a positive amount in the currency's precision", () => {
		expect(parseAmount("12.345", "EUR")).toBeNull();
		expect(parseAmount("5.5", "JPY")).toBeNull();
		expect(parseAmount("-5", "EUR")).toBeNull();
		expect(parseAmount("abc", "EUR")).toBeNull();
		expect(parseAmount("12abc", "EUR")).toBeNull();
		expect(parseAmount("1.2.3", "EUR")).toBeNull();
		expect(parseAmount("", "EUR")).toBeNull();
		expect(parseAmount("0", "EUR")).toBeNull();
		expect(parseAmount("0", "EUR", { allowZero: true })).toBe(0);
	});
});

describe("allocate", () => {
	test("splits evenly and hands the leftover cents to the first shares", () => {
		expect(allocate(1000, 3)).toEqual([334, 333, 333]);
		expect(allocate(-2341, 4)).toEqual([-586, -585, -585, -585]);
		expect(allocate(0, 3)).toEqual([0, 0, 0]);
	});

	test("splits by weight, to the largest remainders", () => {
		expect(allocate(1000, [1, 1, 2])).toEqual([250, 250, 500]);
		expect(allocate(100, [1, 2])).toEqual([33, 67]);
		expect(allocate(100, [0, 0])).toEqual([50, 50]);
	});

	test("always adds back to the total", () => {
		for (let total of [4799, -1, 1, 99999, 7]) {
			for (let parts = 1; parts <= 9; parts++) {
				let shares = allocate(total, parts);
				expect(shares).toHaveLength(parts);
				expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
			}
		}
	});
});

describe("percentOf, convert and sumByCurrency", () => {
	test("takes a percentage to the nearest minor unit", () => {
		expect(percentOf(4280, 15)).toBe(642);
		expect(percentOf(1999, 7.5)).toBe(150);
		expect(percentOf(-1000, 12.5)).toBe(-125);
	});

	test("converts to the target's minor unit", () => {
		expect(convert(10000, "GBP", "EUR", 1.1712)).toBe(11712);
		expect(convert(84500, "JPY", "EUR", 0.006104)).toBe(51579);
		expect(convert(30000, "EUR", "JPY", 163.8)).toBe(49140);
		expect(convert(-2499, "USD", "EUR", 0.9248)).toBe(-2311);
	});

	test("totals each currency apart", () => {
		let totals = sumByCurrency([
			{ amount: 500, currency: "EUR" },
			{ amount: 300, currency: "GBP" },
			{ amount: -200, currency: "EUR" },
		]);
		expect([...totals]).toEqual([
			["EUR", 300],
			["GBP", 300],
		]);
	});
});

describe("formatAmount", () => {
	test("writes each currency with its own decimals and a true minus", () => {
		expect(formatAmount(128000, "JPY")).toBe("¥128,000");
		expect(formatAmount(-129900, "EUR", { locale: "en-IE" })).toBe("−€1,299.00");
		expect(formatAmount(129950, "EUR", { locale: "de-DE" })).toBe("1.299,50 €");
		expect(formatAmount(1234, "BHD", { display: "code" })).toBe("BHD 1.234");
	});

	test("marks money in on a ledger and shows money out plainly", () => {
		expect(formatAmount(4500, "GBP", { sign: "ledger" })).toBe("+£45.00");
		expect(formatAmount(-4500, "GBP", { sign: "ledger" })).toBe("£45.00");
		expect(formatAmount(-4500, "GBP", { sign: "always" })).toBe("−£45.00");
		expect(formatAmount(-4500, "GBP", { sign: "never" })).toBe("£45.00");
	});

	test("abbreviates in compact notation and splits into parts", () => {
		expect(formatAmount(1250000, "USD", { compact: true })).toBe("$12.5K");
		let parts = amountParts(1999, "EUR");
		expect(parts.find((part) => part.type === "fraction")?.value).toBe("99");
	});
});
