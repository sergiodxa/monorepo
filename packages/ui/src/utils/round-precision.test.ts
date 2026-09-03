/**
 * Unit tests for {@link "./round-precision"}: every assertion checks known
 * inputs against known outputs, with no DOM and no rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { roundChannel } from "./round-precision.js";

describe(roundChannel.name, () => {
	test("rounds to the nearest whole number by default", () => {
		expect(roundChannel(127.4)).toBe(127);
		expect(roundChannel(127.6)).toBe(128);
	});

	test("supports a custom precision, e.g. an alpha channel kept to two decimals", () => {
		expect(roundChannel(0.4567, 2)).toBe(0.46);
	});

	test("supports a higher precision, e.g. a chart coordinate kept to six decimals", () => {
		expect(roundChannel(1.0000001, 6)).toBe(1);
		expect(roundChannel(0.12345649, 6)).toBe(0.123456);
	});

	test("rounds a negative value toward the nearest whole number", () => {
		expect(roundChannel(-2.4)).toBe(-2);
	});

	test("leaves an already-precise value unchanged", () => {
		expect(roundChannel(10, 6)).toBe(10);
	});
});
