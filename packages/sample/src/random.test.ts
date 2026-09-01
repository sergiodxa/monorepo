/**
 * Tests for the seeded stream: that a seed replays exactly, that a derived
 * stream stays put no matter how much its parent has drawn, and that the draws
 * respect the bounds they document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom, systemSeed } from "./random";

describe("createRandom", () => {
	test("replays the same sequence from the same seed", () => {
		let first = createRandom("signup-suite");
		let second = createRandom("signup-suite");
		let draws = Array.from({ length: 20 }, () => first.next());

		expect(draws).toEqual(Array.from({ length: 20 }, () => second.next()));
	});

	test("pins a known sequence, so a change to the generator cannot pass quietly", () => {
		let random = createRandom(42);

		expect(Array.from({ length: 8 }, () => random.int(0, 999))).toEqual([
			892, 829, 945, 178, 789, 867, 759, 526,
		]);
	});

	test("gives different seeds different sequences", () => {
		let first = Array.from({ length: 10 }, () => createRandom("a").next());
		let second = Array.from({ length: 10 }, () => createRandom("b").next());

		expect(first).not.toEqual(second);
	});

	test("reads a number seed and its text spelling as the same stream", () => {
		expect(createRandom(42).next()).toBe(createRandom("42").next());
	});

	test("keeps the raw draw inside [0, 1)", () => {
		let random = createRandom("draws");

		for (let count = 0; count < 500; count++) {
			let draw = random.next();
			expect(draw).toBeGreaterThanOrEqual(0);
			expect(draw).toBeLessThan(1);
		}
	});
});

describe("int", () => {
	test("includes both bounds", () => {
		let random = createRandom("bounds");
		let seen = new Set(Array.from({ length: 400 }, () => random.int(1, 6)));

		expect([...seen].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	test("returns the only value a single-value range holds", () => {
		expect(createRandom("one").int(5, 5)).toBe(5);
	});

	test("accepts a negative range", () => {
		let random = createRandom("negative");

		for (let count = 0; count < 100; count++) {
			let value = random.int(-10, -5);
			expect(value).toBeGreaterThanOrEqual(-10);
			expect(value).toBeLessThanOrEqual(-5);
		}
	});

	test("refuses a reversed range", () => {
		expect(() => createRandom("reversed").int(10, 1)).toThrow(RangeError);
	});

	test("refuses a fractional bound", () => {
		expect(() => createRandom("fractional").int(0, 1.5)).toThrow(RangeError);
	});
});

describe("float and bool", () => {
	test("keeps a float inside its range", () => {
		let random = createRandom("floats");

		for (let count = 0; count < 200; count++) {
			let value = random.float(5, 10);
			expect(value).toBeGreaterThanOrEqual(5);
			expect(value).toBeLessThan(10);
		}
	});

	test("treats a chance of zero and one as always false and always true", () => {
		let random = createRandom("chance");

		expect(Array.from({ length: 50 }, () => random.bool(0))).not.toContain(true);
		expect(Array.from({ length: 50 }, () => random.bool(1))).not.toContain(false);
	});
});

describe("pick and shuffle", () => {
	test("picks every element eventually", () => {
		let random = createRandom("picks");
		let items = ["a", "b", "c"];
		let seen = new Set(Array.from({ length: 200 }, () => random.pick(items)));

		expect([...seen].sort()).toEqual(items);
	});

	test("refuses an empty list", () => {
		expect(() => createRandom("empty").pick([])).toThrow(RangeError);
	});

	test("shuffles into a permutation without touching the input", () => {
		let items = [1, 2, 3, 4, 5, 6, 7, 8];
		let shuffled = createRandom("shuffle").shuffle(items);

		expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect([...shuffled].sort((left, right) => left - right)).toEqual(items);
	});
});

describe("derive", () => {
	test("gives a label the same stream however much the parent has drawn", () => {
		let untouched = createRandom("seed");
		let exhausted = createRandom("seed");
		for (let count = 0; count < 100; count++) exhausted.next();

		expect(untouched.derive("orders").int(0, 1_000_000)).toBe(
			exhausted.derive("orders").int(0, 1_000_000),
		);
	});

	test("gives different labels different streams", () => {
		let random = createRandom("seed");

		expect(random.derive("orders").next()).not.toBe(random.derive("invoices").next());
	});

	test("carries a readable seed", () => {
		expect(createRandom("seed").derive("orders").seed).toBe("seed orders");
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
