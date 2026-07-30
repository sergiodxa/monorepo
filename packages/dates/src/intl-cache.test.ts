/**
 * Tests for the formatter cache: that an identical configuration reuses one instance
 * regardless of the order its options were written in, and that any real difference
 * still produces a separate formatter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import {
	dateTimeFormatter,
	listFormatter,
	numberFormatter,
	relativeTimeFormatter,
} from "./intl-cache";

describe("dateTimeFormatter", () => {
	test("reuses one instance for the same locale and options", () => {
		let first = dateTimeFormatter("en-US", { timeZone: "UTC", dateStyle: "medium" });
		let second = dateTimeFormatter("en-US", { timeZone: "UTC", dateStyle: "medium" });
		expect(second).toBe(first);
	});

	test("does not care which order the options were written in", () => {
		let first = dateTimeFormatter("en-GB", { timeZone: "UTC", dateStyle: "long" });
		let second = dateTimeFormatter("en-GB", { dateStyle: "long", timeZone: "UTC" });
		expect(second).toBe(first);
	});

	test("ignores options that were left undefined", () => {
		let first = dateTimeFormatter("en-IE", { timeZone: "UTC", dateStyle: "short" });
		let second = dateTimeFormatter("en-IE", {
			timeZone: "UTC",
			dateStyle: "short",
			timeStyle: undefined,
		});
		expect(second).toBe(first);
	});

	test("builds a separate instance for a different locale", () => {
		let first = dateTimeFormatter("en-AU", { timeZone: "UTC", dateStyle: "medium" });
		let second = dateTimeFormatter("es-AR", { timeZone: "UTC", dateStyle: "medium" });
		expect(second).not.toBe(first);
	});

	test("builds a separate instance for a different zone", () => {
		let first = dateTimeFormatter("en-NZ", { timeZone: "UTC", dateStyle: "medium" });
		let second = dateTimeFormatter("en-NZ", { timeZone: "Asia/Tokyo", dateStyle: "medium" });
		expect(second).not.toBe(first);
	});

	test("distinguishes a locale list from the locale it starts with", () => {
		let first = dateTimeFormatter("en-CA", { timeZone: "UTC", dateStyle: "full" });
		let second = dateTimeFormatter(["en-CA", "fr-CA"], { timeZone: "UTC", dateStyle: "full" });
		expect(second).not.toBe(first);
	});

	test("returns a working formatter, not only a cached object", () => {
		let formatter = dateTimeFormatter("en-US", { timeZone: "UTC", dateStyle: "medium" });
		expect(formatter.format(new Date("2026-07-29T10:00:00Z"))).toBe("Jul 29, 2026");
	});
});

describe("relativeTimeFormatter", () => {
	test("reuses one instance for the same configuration", () => {
		let first = relativeTimeFormatter("en-US", { numeric: "auto" });
		expect(relativeTimeFormatter("en-US", { numeric: "auto" })).toBe(first);
		expect(relativeTimeFormatter("en-US", { numeric: "always" })).not.toBe(first);
	});
});

describe("numberFormatter", () => {
	test("reuses one instance per unit", () => {
		let hours = numberFormatter("en-US", { style: "unit", unit: "hour" });
		expect(numberFormatter("en-US", { style: "unit", unit: "hour" })).toBe(hours);
		expect(numberFormatter("en-US", { style: "unit", unit: "minute" })).not.toBe(hours);
	});
});

describe("listFormatter", () => {
	test("reuses one instance for the same configuration", () => {
		let units = listFormatter("en-US", { type: "unit" });
		expect(listFormatter("en-US", { type: "unit" })).toBe(units);
		expect(listFormatter("en-US", { type: "conjunction" })).not.toBe(units);
	});
});
