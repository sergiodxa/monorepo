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
	return createHelpersModule(createRandom(seed), (path) => `<${path}>`);
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

describe("weightedPick", () => {
	test("returns only the choices it was given", () => {
		let helpers = module("weighted");
		let choices = [
			{ weight: 1, value: "rare" },
			{ weight: 9, value: "common" },
		];

		for (let count = 0; count < 100; count++) {
			expect(["rare", "common"]).toContain(helpers.weightedPick(choices));
		}
	});

	test("follows the weights", () => {
		let helpers = module("weights");
		let choices = [
			{ weight: 1, value: "rare" },
			{ weight: 9, value: "common" },
		];
		let common = Array.from({ length: 1000 }, () => helpers.weightedPick(choices)).filter(
			(value) => value === "common",
		);

		expect(common.length).toBeGreaterThan(820);
		expect(common.length).toBeLessThan(980);
	});

	test("refuses an empty or weightless set", () => {
		let helpers = module("weights");

		expect(() => helpers.weightedPick([])).toThrow(RangeError);
		expect(() => helpers.weightedPick([{ weight: 0, value: "none" }])).toThrow(RangeError);
	});
});

describe("uniqueArray", () => {
	test("draws distinct values from a list", () => {
		let picked = module("unique").uniqueArray([1, 2, 3, 4, 5], 3);

		expect(new Set(picked).size).toBe(3);
	});

	test("draws distinct values from a generator", () => {
		let helpers = module("unique");
		let next = 0;
		let picked = helpers.uniqueArray(() => Math.floor(next++ / 2), 4);

		expect(picked).toEqual([0, 1, 2, 3]);
	});

	test("refuses when the source cannot produce enough", () => {
		expect(() => module("unique").uniqueArray(() => "same", 3)).toThrow(
			/drew 1 distinct values where 3/,
		);
	});
});

describe("objects and enums", () => {
	test("reads a key, a value and an entry", () => {
		let helpers = module("objects");
		let values = { free: 0, pro: 1, team: 2 };

		expect(Object.keys(values)).toContain(helpers.objectKey(values));
		expect(Object.values(values)).toContain(helpers.objectValue(values));

		let [key, value] = helpers.objectEntry(values);
		expect(values[key]).toBe(value);
	});

	test("reads a value of an enum-shaped object", () => {
		let helpers = module("enums");
		let Status = { active: "active", paused: "paused" } as const;

		expect(Object.values(Status)).toContain(helpers.enumValue(Status));
	});

	test("refuses an object with no keys", () => {
		expect(() => module("objects").objectKey({})).toThrow(RangeError);
	});
});

describe("rangeToNumber and slugify", () => {
	test("passes a number through and draws from a range", () => {
		let helpers = module("ranges");

		expect(helpers.rangeToNumber(7)).toBe(7);

		for (let count = 0; count < 50; count++) {
			let value = helpers.rangeToNumber({ min: 3, max: 6 });
			expect(value).toBeGreaterThanOrEqual(3);
			expect(value).toBeLessThanOrEqual(6);
		}
	});

	test("slugifies text", () => {
		let helpers = module("slugs");

		expect(helpers.slugify("Cómo usar Remix v3")).toBe("como-usar-remix-v3");
		expect(helpers.slugify("  Hello, World!  ")).toBe("hello-world");
	});
});

describe("patterns", () => {
	test("replaces each symbol with its own kind of character", () => {
		let helpers = module("symbols");

		expect(helpers.replaceSymbols("###")).toMatch(/^\d{3}$/);
		expect(helpers.replaceSymbols("???")).toMatch(/^[a-z]{3}$/);
		expect(helpers.replaceSymbols("***")).toMatch(/^[a-z0-9]{3}$/);
		expect(helpers.replaceSymbols("ID-##")).toMatch(/^ID-\d{2}$/);
	});

	test("writes a card number whose check digit validates", () => {
		let helpers = module("cards");

		for (let count = 0; count < 50; count++) {
			let digits = helpers.replaceCreditCardSymbols().replace(/\D/g, "");
			let sum = 0;
			let double = false;
			for (let index = digits.length - 1; index >= 0; index--) {
				let digit = Number(digits.charAt(index));
				if (double) {
					digit *= 2;
					if (digit > 9) digit -= 9;
				}
				double = !double;
				sum += digit;
			}
			expect(sum % 10).toBe(0);
		}
	});

	test("builds a string from a pattern", () => {
		let helpers = module("patterns");

		expect(helpers.fromRegExp("[a-z]{5}")).toMatch(/^[a-z]{5}$/);
		expect(helpers.fromRegExp("\\d{3}-\\d{2}")).toMatch(/^\d{3}-\d{2}$/);
		expect(helpers.fromRegExp("SKU-[A-Z]{2}[0-9]{4}")).toMatch(/^SKU-[A-Z]{2}\d{4}$/);
	});

	test("honors a range quantifier", () => {
		let helpers = module("patterns");

		for (let count = 0; count < 50; count++) {
			let value = helpers.fromRegExp("[a-c]{2,5}");
			expect(value.length).toBeGreaterThanOrEqual(2);
			expect(value.length).toBeLessThanOrEqual(5);
		}
	});

	test("refuses an unclosed pattern", () => {
		expect(() => module("patterns").fromRegExp("[a-z")).toThrow(RangeError);
	});
});

describe("templates", () => {
	test("substitutes mustache values, from strings and functions", () => {
		let helpers = module("mustache");

		expect(helpers.mustache("Hi {{name}}", { name: "Ada" })).toBe("Hi Ada");
		expect(helpers.mustache("Hi {{name}}", { name: () => "Ada" })).toBe("Hi Ada");
	});

	test("leaves an unknown placeholder alone", () => {
		expect(module("mustache").mustache("Hi {{name}}", {})).toBe("Hi {{name}}");
	});

	test("fills a template from the generators it names", () => {
		expect(module("fake").fake("{{person.firstName}} of {{location.city}}")).toBe(
			"<person.firstName> of <location.city>",
		);
	});
});
