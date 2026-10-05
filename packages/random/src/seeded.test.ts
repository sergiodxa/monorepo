/**
 * Tests for the seeded stream: that a seed replays exactly, that a derived
 * stream stays put no matter how much its parent has drawn, that a snapshot
 * resumes where it was taken, and that the draws respect their bounds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { RandomState } from "./seeded.js";

import { createRandom, restoreRandom } from "./seeded.js";

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

	test.each([
		[42, [3833195492, 3563769608, 4061610985, 767254976, 3389111029, 3727552234]],
		["signup-suite", [1665886051, 3924901832, 1861224746, 2455819951, 2930940383, 493917030]],
		["", [3075608207, 1941113166, 1250698130, 1973185690, 24547140, 1714710821]],
	])("pins the raw words seed %j produces", (seed, words) => {
		let random = createRandom(seed);

		expect(Array.from({ length: 6 }, () => Math.floor(random.next() * 2 ** 32))).toEqual(words);
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

describe("state and restoreRandom", () => {
	test("resumes exactly where the snapshot was taken", () => {
		let original = createRandom("save");
		for (let count = 0; count < 37; count++) original.next();
		let resumed = restoreRandom(original.state());

		expect(Array.from({ length: 20 }, () => resumed.next())).toEqual(
			Array.from({ length: 20 }, () => original.next()),
		);
	});

	test("survives a JSON round trip", () => {
		let original = createRandom(7);
		original.int(1, 6);
		let resumed = restoreRandom(JSON.parse(JSON.stringify(original.state())) as RandomState);

		expect(resumed.seed).toBe(7);
		expect(resumed.int(0, 1_000_000)).toBe(original.int(0, 1_000_000));
	});

	test("records unsigned 32-bit words", () => {
		let random = createRandom("words");
		for (let count = 0; count < 10; count++) random.next();

		for (let word of random.state().words) {
			expect(Number.isInteger(word)).toBe(true);
			expect(word).toBeGreaterThanOrEqual(0);
			expect(word).toBeLessThanOrEqual(0xffffffff);
		}
	});

	test("leaves the snapshot untouched as the restored stream draws", () => {
		let state = createRandom("frozen").state();
		let words = [...state.words];
		restoreRandom(state).next();

		expect(state.words).toEqual(words);
	});

	test("derives the same streams after a restore", () => {
		let original = createRandom("parent");
		original.next();
		let resumed = restoreRandom(original.state());

		expect(resumed.derive("child").next()).toBe(original.derive("child").next());
	});

	test("resumes a derived stream mid-way", () => {
		let child = createRandom("parent").derive("child");
		child.next();
		child.next();
		let resumed = restoreRandom(child.state());

		expect(resumed.seed).toBe("parent child");
		expect(resumed.next()).toBe(child.next());
	});
});
