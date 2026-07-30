/**
 * Tests for duration wording: that a length breaks into the units a reader expects,
 * that zero components are skipped, and that the unit names and the joining both come
 * from the locale rather than from this package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { DurationString } from "@pkg/duration";

import { formatDuration } from "./format-duration";

describe("formatDuration", () => {
	test("breaks a length into the units it covers", () => {
		expect(formatDuration("90 minutes", { locale: "en-US" })).toBe("1 hour, 30 minutes");
		expect(formatDuration(90_061_000, { locale: "en-US" })).toBe(
			"1 day, 1 hour, 1 minute, 1 second",
		);
	});

	test("skips components that are zero", () => {
		expect(formatDuration("2 hours", { locale: "en-US" })).toBe("2 hours");
		expect(formatDuration("2 days", { locale: "en-US" })).toBe("2 days");
		expect(formatDuration(86_400_000 + 60_000, { locale: "en-US" })).toBe("1 day, 1 minute");
	});

	test("reads a sub-second length in milliseconds", () => {
		expect(formatDuration("500ms", { locale: "en-US" })).toBe("500 milliseconds");
		expect(formatDuration(1500, { locale: "en-US" })).toBe("1 second, 500 milliseconds");
	});

	test("reads a zero length as zero seconds instead of nothing", () => {
		expect(formatDuration(0, { locale: "en-US" })).toBe("0 seconds");
	});

	test("keeps only the components asked for, largest first", () => {
		expect(formatDuration("90 minutes", { locale: "en-US", maxUnits: 1 })).toBe("1 hour");
		expect(formatDuration(90_061_000, { locale: "en-US", maxUnits: 2 })).toBe("1 day, 1 hour");
	});

	test("shortens the unit names when asked to", () => {
		expect(formatDuration("90 minutes", { locale: "en-US", style: "short" })).toBe("1 hr, 30 min");
		expect(formatDuration("90 minutes", { locale: "en-US", style: "narrow" })).toBe("1h 30m");
	});

	test("takes unit names and joining from the locale", () => {
		expect(formatDuration("90 minutes", { locale: "es-AR" })).toBe("1 hora y 30 minutos");
	});

	test("accepts every form of duration input", () => {
		expect(formatDuration("1 hour", { locale: "en-US" })).toBe(
			formatDuration(3_600_000, { locale: "en-US" }),
		);
		expect(formatDuration("1h", { locale: "en-US" })).toBe(
			formatDuration("60 minutes", { locale: "en-US" }),
		);
	});

	test("carries the sign of a negative length on its largest component", () => {
		expect(formatDuration(-5_400_000, { locale: "en-US" })).toBe("-1 hour, 30 minutes");
	});

	test("reports a bypassed duration type instead of repeating it per unit", () => {
		let bypassed = "1 fortnight" as DurationString;
		expect(formatDuration(bypassed, { locale: "en-US" })).toBe("NaN seconds");
	});
});
