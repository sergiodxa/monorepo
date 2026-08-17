/**
 * Tests for the whole-seconds conversion used by HTTP headers and platform TTLs,
 * covering the documented rounding direction, the sub-second floor, and the
 * millisecond input that must not be mistaken for seconds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { DurationString } from "./types";

import { toSeconds } from "./to-seconds";

describe("toSeconds", () => {
	test("converts long spellings", () => {
		expect(toSeconds("1 second")).toBe(1);
		expect(toSeconds("5 minutes")).toBe(300);
		expect(toSeconds("1 hour")).toBe(3600);
		expect(toSeconds("1 day")).toBe(86_400);
		expect(toSeconds("1 week")).toBe(604_800);
	});

	test("converts short aliases", () => {
		expect(toSeconds("30s")).toBe(30);
		expect(toSeconds("15m")).toBe(900);
		expect(toSeconds("24h")).toBe(86_400);
	});

	test("reads a bare number as milliseconds, not seconds", () => {
		expect(toSeconds(1000)).toBe(1);
		expect(toSeconds(60_000)).toBe(60);
	});

	test("rounds to the nearest second, halves up", () => {
		expect(toSeconds(1400)).toBe(1);
		expect(toSeconds(1500)).toBe(2);
		expect(toSeconds(1600)).toBe(2);
		expect(toSeconds("1500ms")).toBe(2);
	});

	test("rounds sub-second durations down to zero", () => {
		expect(toSeconds("400ms")).toBe(0);
		expect(toSeconds(499)).toBe(0);
		expect(toSeconds(0)).toBe(0);
	});

	test("rounds halves toward positive infinity for negatives too", () => {
		expect(toSeconds(-1500)).toBe(-1);
		expect(toSeconds(-1600)).toBe(-2);
		expect(toSeconds("-1 minute")).toBe(-60);
	});

	test("propagates NaN when the compile-time type was bypassed", () => {
		let bypassed = "1 fortnight" as unknown as DurationString;
		expect(toSeconds(bypassed)).toBeNaN();
	});
});
