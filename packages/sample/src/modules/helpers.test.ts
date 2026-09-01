/**
 * Tests for the repeating helpers: that a pick stays inside the caller's list,
 * that distinct picks really are distinct, and that asking for more than the
 * list holds fails instead of returning a short answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom } from "../random";

import { createHelpersModule } from "./helpers";

function module(seed: string) {
	return createHelpersModule(createRandom(seed));
}

describe("pick", () => {
	test("returns an element of the list", () => {
		let helpers = module("pick");
		let items = ["free", "pro", "team"];

		for (let count = 0; count < 100; count++) {
			expect(items).toContain(helpers.pick(items));
		}
	});

	test("refuses an empty list", () => {
		expect(() => module("pick").pick([])).toThrow(RangeError);
	});
});

describe("pickMany", () => {
	test("returns distinct elements", () => {
		let helpers = module("many");

		for (let count = 0; count < 50; count++) {
			let picked = helpers.pickMany([1, 2, 3, 4, 5, 6], { count: 4 });
			expect(picked).toHaveLength(4);
			expect(new Set(picked).size).toBe(4);
		}
	});

	test("returns the whole list when asked for all of it", () => {
		let picked = module("all").pickMany([1, 2, 3], { count: 3 });

		expect([...picked].sort((left, right) => left - right)).toEqual([1, 2, 3]);
	});

	test("returns nothing for a count of zero", () => {
		expect(module("none").pickMany([1, 2, 3], { count: 0 })).toEqual([]);
	});

	test("refuses to pick more than the list holds", () => {
		expect(() => module("too-many").pickMany([1, 2], { count: 3 })).toThrow(
			/needs 3 items to pick from, the list holds 2/,
		);
	});

	test("refuses a count that is not a count", () => {
		expect(() => module("bad").pickMany([1, 2], { count: -1 })).toThrow(RangeError);
	});
});

describe("shuffle", () => {
	test("returns a permutation and leaves the input alone", () => {
		let items = [1, 2, 3, 4, 5];
		let shuffled = module("shuffle").shuffle(items);

		expect(items).toEqual([1, 2, 3, 4, 5]);
		expect([...shuffled].sort((left, right) => left - right)).toEqual(items);
	});
});

describe("multiple", () => {
	test("calls the builder with each index", () => {
		expect(module("multiple").multiple((index) => index * 2, { count: 4 })).toEqual([0, 2, 4, 6]);
	});

	test("returns nothing for a count of zero", () => {
		expect(module("multiple").multiple(() => "value", { count: 0 })).toEqual([]);
	});

	test("refuses a count that is not a count", () => {
		expect(() => module("bad").multiple(() => "value", { count: -2 })).toThrow(
			/multiple\(\) needs a count/,
		);
	});
});

describe("maybe", () => {
	test("treats a chance of zero and one as never and always", () => {
		let helpers = module("maybe");

		expect(helpers.maybe(() => "value", { chance: 0 })).toBeNull();
		expect(helpers.maybe(() => "value", { chance: 1 })).toBe("value");
	});

	test("leaves the value out about half the time by default", () => {
		let helpers = module("halves");
		let present = Array.from({ length: 1000 }, () => helpers.maybe(() => "value")).filter(
			(value) => value !== null,
		);

		expect(present.length).toBeGreaterThan(400);
		expect(present.length).toBeLessThan(600);
	});

	test("skips the builder entirely when the value is absent", () => {
		let calls = 0;
		let helpers = module("skipped");

		helpers.maybe(() => calls++, { chance: 0 });

		expect(calls).toBe(0);
	});
});
