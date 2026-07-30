/**
 * Tests for the unit tables: that every long spelling and short alias covers the
 * same fixed span, that the spans are the expected millisecond counts, and that
 * unknown or calendar-based units are not in the tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { LONG_UNIT_MS, longUnitToMs, SECOND_MS, SHORT_UNIT_MS, shortUnitToMs } from "./units";

describe("unit tables", () => {
	test("a second is a thousand milliseconds", () => {
		expect(SECOND_MS).toBe(1000);
	});

	test("long spellings cover the expected spans", () => {
		expect(LONG_UNIT_MS.millisecond).toBe(1);
		expect(LONG_UNIT_MS.second).toBe(1000);
		expect(LONG_UNIT_MS.minute).toBe(60_000);
		expect(LONG_UNIT_MS.hour).toBe(3_600_000);
		expect(LONG_UNIT_MS.day).toBe(86_400_000);
		expect(LONG_UNIT_MS.week).toBe(604_800_000);
	});

	test("plural spellings match their singular", () => {
		expect(LONG_UNIT_MS.milliseconds).toBe(LONG_UNIT_MS.millisecond);
		expect(LONG_UNIT_MS.seconds).toBe(LONG_UNIT_MS.second);
		expect(LONG_UNIT_MS.minutes).toBe(LONG_UNIT_MS.minute);
		expect(LONG_UNIT_MS.hours).toBe(LONG_UNIT_MS.hour);
		expect(LONG_UNIT_MS.days).toBe(LONG_UNIT_MS.day);
		expect(LONG_UNIT_MS.weeks).toBe(LONG_UNIT_MS.week);
	});

	test("short aliases match their long spelling", () => {
		expect(SHORT_UNIT_MS.ms).toBe(LONG_UNIT_MS.millisecond);
		expect(SHORT_UNIT_MS.s).toBe(LONG_UNIT_MS.second);
		expect(SHORT_UNIT_MS.m).toBe(LONG_UNIT_MS.minute);
		expect(SHORT_UNIT_MS.h).toBe(LONG_UNIT_MS.hour);
		expect(SHORT_UNIT_MS.d).toBe(LONG_UNIT_MS.day);
		expect(SHORT_UNIT_MS.w).toBe(LONG_UNIT_MS.week);
	});

	test("every long spelling has a short alias covering the same span", () => {
		let spans = new Set(Object.values(LONG_UNIT_MS));
		expect(new Set(Object.values(SHORT_UNIT_MS))).toEqual(spans);
	});

	test("the unit list stays closed", () => {
		expect(Object.keys(LONG_UNIT_MS)).toHaveLength(12);
		expect(Object.keys(SHORT_UNIT_MS)).toHaveLength(6);
	});
});

describe("longUnitToMs", () => {
	test("resolves accepted spellings", () => {
		expect(longUnitToMs("minutes")).toBe(60_000);
		expect(longUnitToMs("week")).toBe(604_800_000);
	});

	test("returns undefined for a typo instead of guessing", () => {
		expect(longUnitToMs("minuts")).toBeUndefined();
		expect(longUnitToMs("")).toBeUndefined();
		expect(longUnitToMs("Minutes")).toBeUndefined();
	});

	test("has no calendar units, whose length is not fixed", () => {
		expect(longUnitToMs("month")).toBeUndefined();
		expect(longUnitToMs("months")).toBeUndefined();
		expect(longUnitToMs("year")).toBeUndefined();
		expect(longUnitToMs("years")).toBeUndefined();
	});

	test("does not resolve short aliases", () => {
		expect(longUnitToMs("ms")).toBeUndefined();
		expect(longUnitToMs("h")).toBeUndefined();
	});

	test("does not resolve inherited object properties", () => {
		expect(longUnitToMs("toString")).toBeUndefined();
		expect(longUnitToMs("constructor")).toBeUndefined();
	});
});

describe("shortUnitToMs", () => {
	test("resolves accepted aliases", () => {
		expect(shortUnitToMs("ms")).toBe(1);
		expect(shortUnitToMs("h")).toBe(3_600_000);
	});

	test("returns undefined for unknown aliases", () => {
		expect(shortUnitToMs("y")).toBeUndefined();
		expect(shortUnitToMs("")).toBeUndefined();
		expect(shortUnitToMs("S")).toBeUndefined();
	});

	test("does not resolve long spellings", () => {
		expect(shortUnitToMs("minutes")).toBeUndefined();
	});
});
