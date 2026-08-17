/**
 * Type-level tests for the duration vocabulary: every accepted form is assignable
 * to the duration string type, and each malformed form is a compile error, which
 * the `@ts-expect-error` directives assert by failing the typecheck if it isn't.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { DurationInput, DurationString } from "./types";
import type { DurationUnit, DurationUnitShort } from "./units";

import { toMs } from "./to-ms";
import { toSeconds } from "./to-seconds";

describe("DurationString", () => {
	test("accepts every long spelling after a single space", () => {
		let values: DurationString[] = [
			"1 millisecond",
			"250 milliseconds",
			"1 second",
			"30 seconds",
			"1 minute",
			"5 minutes",
			"1 hour",
			"12 hours",
			"1 day",
			"30 days",
			"1 week",
			"2 weeks",
		];

		expect(values).toHaveLength(12);
	});

	test("accepts every short alias with no space", () => {
		let values: DurationString[] = ["500ms", "30s", "15m", "6h", "30d", "1w"];
		expect(values).toHaveLength(6);
	});

	test("accepts zero and negative amounts", () => {
		let values: DurationString[] = ["0 seconds", "0s", "-1 hour", "-30s"];
		expect(values).toHaveLength(4);
	});

	test("covers each unit name once", () => {
		let long: DurationUnit[] = ["millisecond", "second", "minute", "hour", "day", "week"];
		let short: DurationUnitShort[] = ["ms", "s", "m", "h", "d", "w"];
		expect(long).toHaveLength(short.length);
	});
});

describe("DurationInput", () => {
	test("accepts a duration string or a number of milliseconds", () => {
		let inputs: DurationInput[] = ["5 minutes", "30s", 1500, 0];
		expect(inputs.map(toMs)).toEqual([300_000, 30_000, 1500, 0]);
	});
});

describe("malformed durations are compile errors", () => {
	test("rejects a misspelled unit", () => {
		// @ts-expect-error "minuts" is not a unit, so the typo never reaches runtime
		expect(toMs("5 minuts")).toBeNaN();
	});

	test("rejects fractional and exponent amounts", () => {
		// @ts-expect-error fractional amounts are unsupported
		expect(toMs("1.5h")).toBeNaN();
		// @ts-expect-error fractional amounts are unsupported
		expect(toMs("1.5 hours")).toBeNaN();
		// @ts-expect-error exponent notation is unsupported
		expect(toMs("5e3s")).toBeNaN();
	});

	test("rejects non-canonical amounts", () => {
		// @ts-expect-error a leading zero is not a canonical amount
		expect(toMs("05s")).toBeNaN();
		// @ts-expect-error an explicit plus sign is not a canonical amount
		expect(toMs("+5s")).toBeNaN();
	});

	test("rejects unit-only text", () => {
		// @ts-expect-error an amount is required
		expect(toMs("hour")).toBeNaN();
		// @ts-expect-error an amount is required
		expect(toMs("ms")).toBeNaN();
	});

	test("rejects spacing the other form uses", () => {
		// @ts-expect-error a short alias takes no space
		expect(toMs("5 m")).toBeNaN();
		// @ts-expect-error a long spelling requires its space
		expect(toMs("5minutes")).toBeNaN();
	});

	test("rejects uppercase units", () => {
		// @ts-expect-error units are lowercase
		expect(toMs("5 Minutes")).toBeNaN();
		// @ts-expect-error units are lowercase
		expect(toMs("30S")).toBeNaN();
	});

	test("rejects calendar units, whose length is not fixed", () => {
		// @ts-expect-error a month has no fixed length
		expect(toMs("1 month")).toBeNaN();
		// @ts-expect-error a year has no fixed length
		expect(toSeconds("1 year")).toBeNaN();
	});

	test("rejects an empty string", () => {
		// @ts-expect-error an empty string is not a duration
		expect(toMs("")).toBeNaN();
	});

	test("rejects a duration assembled from a variable", () => {
		let count = 5;
		// @ts-expect-error an assembled template widens to `${number} minutes`
		expect(toMs(`${count} minutes`)).toBe(300_000);
	});

	test("rejects unchecked text, which parse() exists to handle", () => {
		let text = String("5 minutes");
		// @ts-expect-error a plain string must go through parse() first
		expect(toMs(text)).toBe(300_000);
	});
});
