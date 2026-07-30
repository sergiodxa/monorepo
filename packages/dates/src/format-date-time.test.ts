/**
 * Tests for the `Intl.DateTimeFormat` wrappers. They assert against formatters built
 * inline rather than against literal strings, so the tests pin down which options are
 * wired through and stay valid as the platform's locale data changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { formatDate, formatDateTime, formatRange, formatTime } from "./format-date-time";

/** The instant every case formats, mid-morning UTC on a Wednesday. */
const MORNING = new Date("2026-07-29T10:00:00Z");

describe("formatDate", () => {
	test("renders the date at medium length by default", () => {
		expect(formatDate(MORNING, { locale: "en-US", timeZone: "UTC" })).toBe(
			new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium" }).format(MORNING),
		);
		expect(formatDate(MORNING, { locale: "en-US", timeZone: "UTC" })).toBe("Jul 29, 2026");
	});

	test("passes the requested length through", () => {
		expect(formatDate(MORNING, { locale: "en-US", timeZone: "UTC", dateStyle: "full" })).toBe(
			new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "full" }).format(MORNING),
		);
	});

	test("renders the calendar day of the zone asked for", () => {
		let lateUtc = new Date("2026-07-29T02:00:00Z");
		expect(formatDate(lateUtc, { locale: "en-US", timeZone: "UTC" })).toContain("29");
		expect(formatDate(lateUtc, { locale: "en-US", timeZone: "America/New_York" })).toContain("28");
	});

	test("takes month names from the locale", () => {
		expect(formatDate(MORNING, { locale: "es-AR", timeZone: "UTC", dateStyle: "long" })).toContain(
			"julio",
		);
	});

	test("accepts a locale preference list", () => {
		expect(formatDate(MORNING, { locale: ["xx-YY", "es-AR"], timeZone: "UTC" })).toBe(
			new Intl.DateTimeFormat(["xx-YY", "es-AR"], { timeZone: "UTC", dateStyle: "medium" }).format(
				MORNING,
			),
		);
	});
});

describe("formatTime", () => {
	test("renders the time at short length by default", () => {
		expect(formatTime(MORNING, { locale: "en-US", timeZone: "UTC" })).toBe(
			new Intl.DateTimeFormat("en-US", { timeZone: "UTC", timeStyle: "short" }).format(MORNING),
		);
		expect(formatTime(MORNING, { locale: "en-US", timeZone: "UTC" })).toMatch(/10:00/);
	});

	test("renders the clock of the zone asked for", () => {
		expect(formatTime(MORNING, { locale: "en-US", timeZone: "America/New_York" })).toMatch(/6:00/);
		expect(formatTime(MORNING, { locale: "en-US", timeZone: "Asia/Tokyo" })).toMatch(/7:00/);
	});

	test("passes the requested length through", () => {
		expect(formatTime(MORNING, { locale: "en-US", timeZone: "UTC", timeStyle: "medium" })).toBe(
			new Intl.DateTimeFormat("en-US", { timeZone: "UTC", timeStyle: "medium" }).format(MORNING),
		);
	});

	test("takes the clock convention from the locale", () => {
		expect(formatTime(MORNING, { locale: "es-AR", timeZone: "UTC" })).not.toMatch(/AM/);
	});
});

describe("formatDateTime", () => {
	test("renders both halves with the locale's own joining", () => {
		expect(formatDateTime(MORNING, { locale: "en-US", timeZone: "UTC" })).toBe(
			new Intl.DateTimeFormat("en-US", {
				timeZone: "UTC",
				dateStyle: "medium",
				timeStyle: "short",
			}).format(MORNING),
		);
	});

	test("includes the date and the time", () => {
		let formatted = formatDateTime(MORNING, { locale: "en-US", timeZone: "UTC" });
		expect(formatted).toContain("Jul 29, 2026");
		expect(formatted).toMatch(/10:00/);
	});

	test("passes both requested lengths through", () => {
		expect(
			formatDateTime(MORNING, {
				locale: "en-US",
				timeZone: "UTC",
				dateStyle: "short",
				timeStyle: "medium",
			}),
		).toBe(
			new Intl.DateTimeFormat("en-US", {
				timeZone: "UTC",
				dateStyle: "short",
				timeStyle: "medium",
			}).format(MORNING),
		);
	});
});

describe("formatRange", () => {
	test("collapses what both ends share", () => {
		let end = new Date("2026-07-31T10:00:00Z");
		let formatted = formatRange(MORNING, end, { locale: "en-US", timeZone: "UTC" });
		expect(formatted).toBe(
			new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium" }).formatRange(
				MORNING,
				end,
			),
		);
		expect(formatted).toContain("Jul 29");
		expect(formatted).toContain("31");
		expect(formatted).toContain("2026");
	});

	test("leaves the time out unless a length is asked for", () => {
		expect(
			formatRange(MORNING, new Date("2026-07-31T10:00:00Z"), {
				locale: "en-US",
				timeZone: "UTC",
			}),
		).not.toMatch(/10:00/);
		expect(
			formatRange(MORNING, new Date("2026-07-29T14:00:00Z"), {
				locale: "en-US",
				timeZone: "UTC",
				timeStyle: "short",
			}),
		).toMatch(/10:00/);
	});

	test("renders one date when both ends fall on the same day", () => {
		expect(formatRange(MORNING, MORNING, { locale: "en-US", timeZone: "UTC" })).toBe(
			formatDate(MORNING, { locale: "en-US", timeZone: "UTC" }),
		);
	});

	test("renders both ends in the zone asked for", () => {
		let end = new Date("2026-07-29T02:30:00Z");
		let start = new Date("2026-07-29T02:00:00Z");
		expect(formatRange(start, end, { locale: "en-US", timeZone: "America/New_York" })).toContain(
			"28",
		);
	});
});
