/**
 * Tests for numbers: the defaults a bare call falls back to, the bounds an
 * options object sets, and the rounding that keeps a float printable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom } from "../random.js";

import { createNumberModule } from "./number.js";

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

describe("the other bases", () => {
	test("writes hex, binary and octal digits", () => {
		let numbers = module("bases");

		expect(numbers.hex()).toMatch(/^[0-9a-f]+$/);
		expect(numbers.binary()).toMatch(/^[01]+$/);
		expect(numbers.octal()).toMatch(/^[0-7]+$/);
	});

	test("honors the bounds a base is given", () => {
		let numbers = module("bounded");

		for (let count = 0; count < 50; count++) {
			expect(Number.parseInt(numbers.hex({ min: 16, max: 31 }), 16)).toBeGreaterThanOrEqual(16);
			expect(Number.parseInt(numbers.hex({ min: 16, max: 31 }), 16)).toBeLessThanOrEqual(31);
		}
	});
});

describe("romanNumeral", () => {
	test("writes only roman digits", () => {
		let numbers = module("roman");

		for (let count = 0; count < 100; count++) {
			expect(numbers.romanNumeral()).toMatch(/^[MDCLXVI]+$/);
		}
	});

	test("writes the numeral a known value has", () => {
		let numbers = module("roman");

		expect(numbers.romanNumeral({ min: 4, max: 4 })).toBe("IV");
		expect(numbers.romanNumeral({ min: 1994, max: 1994 })).toBe("MCMXCIV");
		expect(numbers.romanNumeral({ min: 3999, max: 3999 })).toBe("MMMCMXCIX");
	});

	test("refuses a value it cannot write", () => {
		expect(() => module("roman").romanNumeral({ min: 0, max: 0 })).toThrow(RangeError);
	});
});

describe("bigInt", () => {
	test("stays inside the range it is given", () => {
		let numbers = module("big");

		for (let count = 0; count < 50; count++) {
			let value = numbers.bigInt({ min: 10n, max: 20n });
			expect(value).toBeGreaterThanOrEqual(10n);
			expect(value).toBeLessThanOrEqual(20n);
		}
	});

	test("reaches past what a number can hold", () => {
		let numbers = module("big");
		let value = numbers.bigInt({ min: 2n ** 64n, max: 2n ** 65n });

		expect(value).toBeGreaterThanOrEqual(2n ** 64n);
	});

	test("refuses a reversed range", () => {
		expect(() => module("big").bigInt({ min: 20n, max: 10n })).toThrow(RangeError);
	});
});
