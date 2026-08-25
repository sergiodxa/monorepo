/**
 * Tests for relative time wording: that the unit chosen is the largest one the
 * distance justifies, that a distance which rounds to a whole unit carries into
 * the next unit up, and that the comparison instant is an argument.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { formatRelative } from "./format-relative";

/** The instant every test measures against, so each case uses a fixed instant. */
const NOW = new Date("2026-07-29T12:00:00Z");

/** Shift `NOW` by a number of milliseconds, positive into the future. */
function at(ms: number): Date {
	return new Date(NOW.getTime() + ms);
}

describe("formatRelative", () => {
	test("words the past and the future differently", () => {
		expect(formatRelative(at(-3 * 86_400_000), { locale: "en-US", now: NOW })).toBe("3 days ago");
		expect(formatRelative(at(3 * 86_400_000), { locale: "en-US", now: NOW })).toBe("in 3 days");
	});

	test("picks the largest unit the distance justifies", () => {
		/** Forces numeric wording so every case names the unit it picked. */
		let numeric = "always" as const;
		expect(formatRelative(at(45_000), { locale: "en-US", now: NOW, numeric })).toBe(
			"in 45 seconds",
		);
		expect(formatRelative(at(20 * 60_000), { locale: "en-US", now: NOW, numeric })).toBe(
			"in 20 minutes",
		);
		expect(formatRelative(at(5 * 3_600_000), { locale: "en-US", now: NOW, numeric })).toBe(
			"in 5 hours",
		);
		expect(formatRelative(at(6 * 86_400_000), { locale: "en-US", now: NOW, numeric })).toBe(
			"in 6 days",
		);
		expect(formatRelative(at(21 * 86_400_000), { locale: "en-US", now: NOW, numeric })).toBe(
			"in 3 weeks",
		);
		expect(formatRelative(at(60 * 86_400_000), { locale: "en-US", now: NOW, numeric })).toBe(
			"in 2 months",
		);
		expect(formatRelative(at(400 * 86_400_000), { locale: "en-US", now: NOW, numeric })).toBe(
			"in 1 year",
		);
	});

	test("carries a rounded distance into the next unit", () => {
		/** 59.6 seconds rounds to 60, reading as a whole minute. */
		expect(formatRelative(at(59_600), { locale: "en-US", now: NOW })).toBe("in 1 minute");
		expect(
			formatRelative(at(23.7 * 3_600_000), { locale: "en-US", now: NOW, numeric: "always" }),
		).toBe("in 1 day");
	});

	test("rounds to the nearest whole unit", () => {
		expect(formatRelative(at(90 * 60_000), { locale: "en-US", now: NOW })).toBe("in 2 hours");
	});

	test("lets the locale use a word where it has one", () => {
		expect(formatRelative(at(-86_400_000), { locale: "en-US", now: NOW })).toBe("yesterday");
		expect(formatRelative(at(86_400_000), { locale: "en-US", now: NOW })).toBe("tomorrow");
		expect(formatRelative(at(400), { locale: "en-US", now: NOW })).toBe("now");
	});

	test("forces a number when asked to", () => {
		expect(formatRelative(at(-86_400_000), { locale: "en-US", now: NOW, numeric: "always" })).toBe(
			"1 day ago",
		);
	});

	test("shortens the wording when asked to", () => {
		expect(formatRelative(at(-3 * 86_400_000), { locale: "en-US", now: NOW, style: "short" })).toBe(
			"3 days ago",
		);
		expect(formatRelative(at(-3 * 3_600_000), { locale: "en-US", now: NOW, style: "narrow" })).toBe(
			"3h ago",
		);
	});

	test("takes the phrasing from the locale", () => {
		expect(formatRelative(at(3 * 86_400_000), { locale: "es-AR", now: NOW })).toBe(
			"dentro de 3 días",
		);
	});

	test("measures against the current time when none is supplied", () => {
		expect(formatRelative(new Date(Date.now() - 3 * 86_400_000), { locale: "en-US" })).toBe(
			"3 days ago",
		);
	});
});
