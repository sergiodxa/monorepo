/**
 * Tests for the Web Crypto stream and seed: that draws respect the same bounds
 * as a seeded stream across buffer refills, and that seeds are fresh 32-bit
 * integers carrying entropy in every byte.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { systemRandom, systemSeed } from "./system.js";

describe("systemRandom", () => {
	test("keeps the raw draw inside [0, 1) across buffer refills", () => {
		let random = systemRandom();

		for (let count = 0; count < 500; count++) {
			let draw = random.next();
			expect(draw).toBeGreaterThanOrEqual(0);
			expect(draw).toBeLessThan(1);
		}
	});

	test("draws a fresh value each time", () => {
		let random = systemRandom();

		expect(new Set(Array.from({ length: 200 }, () => random.next())).size).toBe(200);
	});

	test("gives independent streams independent values", () => {
		expect(systemRandom().next()).not.toBe(systemRandom().next());
	});

	test("includes both bounds of an int range", () => {
		let random = systemRandom();
		let seen = new Set(Array.from({ length: 400 }, () => random.int(1, 6)));

		expect([...seen].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	test("refuses the same invalid input a seeded stream refuses", () => {
		let random = systemRandom();

		expect(() => random.int(10, 1)).toThrow(RangeError);
		expect(() => random.pick([])).toThrow(RangeError);
	});
});

describe("systemSeed", () => {
	test("returns a 32-bit integer", () => {
		let seed = systemSeed();

		expect(Number.isSafeInteger(seed)).toBe(true);
		expect(seed).toBeGreaterThanOrEqual(0);
		expect(seed).toBeLessThanOrEqual(0xffffffff);
	});

	test("draws a fresh seed on each call", () => {
		expect(new Set(Array.from({ length: 100 }, () => systemSeed())).size).toBe(100);
	});

	test("carries entropy in its high bits, not only its low ones", () => {
		let leading = new Set(Array.from({ length: 200 }, () => systemSeed() >>> 24));

		expect(leading.size).toBeGreaterThan(50);
	});
});
