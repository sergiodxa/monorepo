/**
 * Tests for the runtime parser: that it accepts exactly the forms the duration
 * string type allows plus a bare millisecond amount, and that everything else
 * comes back as a failure naming the rejected text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isFailure, isSuccess, unwrap } from "@pkg/result";

import { InvalidDurationError } from "./invalid-duration-error";
import { parse } from "./parse";

describe("parse", () => {
	test("parses long spellings written with a single space", () => {
		expect(unwrap(parse("1 millisecond"))).toBe(1);
		expect(unwrap(parse("250 milliseconds"))).toBe(250);
		expect(unwrap(parse("1 second"))).toBe(1000);
		expect(unwrap(parse("30 seconds"))).toBe(30_000);
		expect(unwrap(parse("5 minutes"))).toBe(300_000);
		expect(unwrap(parse("1 hour"))).toBe(3_600_000);
		expect(unwrap(parse("2 hours"))).toBe(7_200_000);
		expect(unwrap(parse("1 day"))).toBe(86_400_000);
		expect(unwrap(parse("7 days"))).toBe(604_800_000);
		expect(unwrap(parse("1 week"))).toBe(604_800_000);
		expect(unwrap(parse("2 weeks"))).toBe(1_209_600_000);
	});

	test("parses short aliases written with no space", () => {
		expect(unwrap(parse("500ms"))).toBe(500);
		expect(unwrap(parse("30s"))).toBe(30_000);
		expect(unwrap(parse("15m"))).toBe(900_000);
		expect(unwrap(parse("6h"))).toBe(21_600_000);
		expect(unwrap(parse("30d"))).toBe(2_592_000_000);
		expect(unwrap(parse("1w"))).toBe(604_800_000);
	});

	test("reads a bare amount as milliseconds", () => {
		expect(unwrap(parse("0"))).toBe(0);
		expect(unwrap(parse("1500"))).toBe(1500);
		expect(unwrap(parse("3600000"))).toBe(3_600_000);
	});

	test("accepts a zero amount for every unit", () => {
		expect(unwrap(parse("0 hours"))).toBe(0);
		expect(unwrap(parse("0h"))).toBe(0);
	});

	test("keeps the sign of a negative amount", () => {
		expect(unwrap(parse("-5 minutes"))).toBe(-300_000);
		expect(unwrap(parse("-30s"))).toBe(-30_000);
		expect(unwrap(parse("-1500"))).toBe(-1500);
	});

	test("trims surrounding whitespace", () => {
		expect(unwrap(parse("  5 minutes  "))).toBe(300_000);
		expect(unwrap(parse("\n30s\t"))).toBe(30_000);
	});

	test("rejects a misspelled unit rather than falling back to a default", () => {
		let result = parse("5 minuts");
		expect(isFailure(result)).toBe(true);
	});

	test("rejects fractional and exponent amounts", () => {
		expect(isFailure(parse("1.5h"))).toBe(true);
		expect(isFailure(parse("1.5 hours"))).toBe(true);
		expect(isFailure(parse("5e3s"))).toBe(true);
		expect(isFailure(parse("0x10s"))).toBe(true);
		expect(isFailure(parse("1,5h"))).toBe(true);
	});

	test("rejects non-canonical amounts", () => {
		expect(isFailure(parse("05s"))).toBe(true);
		expect(isFailure(parse("+5s"))).toBe(true);
		expect(isFailure(parse("1_000ms"))).toBe(true);
	});

	test("rejects spacing the type does not allow", () => {
		expect(isFailure(parse("5 m"))).toBe(true);
		expect(isFailure(parse("5minutes"))).toBe(true);
		expect(isFailure(parse("5  minutes"))).toBe(true);
	});

	test("rejects unit-only and empty text", () => {
		expect(isFailure(parse("hour"))).toBe(true);
		expect(isFailure(parse("ms"))).toBe(true);
		expect(isFailure(parse(""))).toBe(true);
		expect(isFailure(parse("   "))).toBe(true);
	});

	test("rejects calendar units, whose length is not fixed", () => {
		expect(isFailure(parse("1 month"))).toBe(true);
		expect(isFailure(parse("1 year"))).toBe(true);
		expect(isFailure(parse("1y"))).toBe(true);
	});

	test("rejects uppercase units", () => {
		expect(isFailure(parse("5 Minutes"))).toBe(true);
		expect(isFailure(parse("30S"))).toBe(true);
	});

	test("rejects compound and trailing text", () => {
		expect(isFailure(parse("1 hour 30 minutes"))).toBe(true);
		expect(isFailure(parse("5 minutes please"))).toBe(true);
	});

	test("rejects text that could reach an inherited property", () => {
		expect(isFailure(parse("1 toString"))).toBe(true);
		expect(isFailure(parse("1 constructor"))).toBe(true);
	});

	test("reports the rejected text verbatim on the error", () => {
		let result = parse("  5 minuts ");
		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(InvalidDurationError);
		expect(result.error.name).toBe("InvalidDurationError");
		expect(result.error.text).toBe("  5 minuts ");
		expect(result.error.message).toBe('Invalid duration: "  5 minuts "');
	});

	test("returns a failure instead of throwing", () => {
		expect(() => parse("nonsense")).not.toThrow();
	});
});
