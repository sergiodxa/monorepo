/**
 * Tests for numbers: the defaults a bare call falls back to, the bounds an
 * options object sets, and the rounding that keeps a float printable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom } from "../random";

import { createNumberModule } from "./number";

function module(seed: string) {
	return createNumberModule(createRandom(seed));
}

describe("int", () => {
	test("falls back to zero through one hundred", () => {
		let numbers = module("defaults");

		for (let count = 0; count < 300; count++) {
			let value = numbers.int();
			expect(Number.isInteger(value)).toBe(true);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(100);
		}
	});

	test("includes both bounds it is given", () => {
		let numbers = module("bounds");
		let seen = new Set(Array.from({ length: 300 }, () => numbers.int({ min: 1, max: 4 })));

		expect([...seen].sort((left, right) => left - right)).toEqual([1, 2, 3, 4]);
	});

	test("returns the only value a single-value range holds", () => {
		expect(module("single").int({ min: 7, max: 7 })).toBe(7);
	});

	test("refuses a range that ends below where it starts", () => {
		expect(() => module("reversed").int({ min: 10, max: 1 })).toThrow(RangeError);
	});
});

describe("float", () => {
	test("falls back to zero through one", () => {
		let numbers = module("float-defaults");

		for (let count = 0; count < 200; count++) {
			let value = numbers.float();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	test("keeps the digits it was asked for", () => {
		let numbers = module("digits");

		for (let count = 0; count < 100; count++) {
			let value = numbers.float({ min: 0, max: 1000, fractionDigits: 2 });
			expect(value).toBe(Number(value.toFixed(2)));
		}
	});

	test("returns a whole number when asked for no digits", () => {
		let numbers = module("whole");

		for (let count = 0; count < 100; count++) {
			expect(Number.isInteger(numbers.float({ min: 0, max: 50, fractionDigits: 0 }))).toBe(true);
		}
	});

	test("stays inside the range it is given", () => {
		let numbers = module("float-bounds");

		for (let count = 0; count < 200; count++) {
			let value = numbers.float({ min: -5, max: 5 });
			expect(value).toBeGreaterThanOrEqual(-5);
			expect(value).toBeLessThanOrEqual(5);
		}
	});
});
