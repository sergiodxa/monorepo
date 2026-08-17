/**
 * Tests for the milliseconds conversion: that bare numbers pass through, that
 * every accepted string form resolves to the same value the parser reports, and
 * that a bypassed type degrades to `NaN` instead of throwing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { DurationString } from "./types";

import { parse } from "./parse";
import { toMs } from "./to-ms";

describe("toMs", () => {
	test("passes a bare number through as milliseconds", () => {
		expect(toMs(0)).toBe(0);
		expect(toMs(1500)).toBe(1500);
		expect(toMs(-1500)).toBe(-1500);
		expect(toMs(3_600_000)).toBe(3_600_000);
	});

	test("converts long spellings", () => {
		expect(toMs("1 millisecond")).toBe(1);
		expect(toMs("30 seconds")).toBe(30_000);
		expect(toMs("5 minutes")).toBe(300_000);
		expect(toMs("1 hour")).toBe(3_600_000);
		expect(toMs("7 days")).toBe(604_800_000);
		expect(toMs("2 weeks")).toBe(1_209_600_000);
	});

	test("converts short aliases", () => {
		expect(toMs("500ms")).toBe(500);
		expect(toMs("30s")).toBe(30_000);
		expect(toMs("15m")).toBe(900_000);
		expect(toMs("6h")).toBe(21_600_000);
		expect(toMs("30d")).toBe(2_592_000_000);
		expect(toMs("1w")).toBe(604_800_000);
	});

	test("replaces the arithmetic a call site would otherwise inline", () => {
		expect(toMs("1 week")).toBe(1000 * 60 * 60 * 24 * 7);
	});

	test("agrees with the parser on every accepted form", () => {
		let inputs: DurationString[] = ["1 millisecond", "90 seconds", "5 minutes", "12 hours", "1w"];
		for (let input of inputs) expect(toMs(input)).toBe(unwrap(parse(input)));
	});

	test("keeps the sign of a negative amount", () => {
		expect(toMs("-5 minutes")).toBe(-300_000);
		expect(toMs("-30s")).toBe(-30_000);
	});

	test("returns NaN when the compile-time type was bypassed", () => {
		let bypassed = "5 minuts" as unknown as DurationString;
		expect(toMs(bypassed)).toBeNaN();
	});

	test("never throws on malformed text", () => {
		let bypassed = "" as unknown as DurationString;
		expect(() => toMs(bypassed)).not.toThrow();
	});
});
