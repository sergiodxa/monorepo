/**
 * Tests for the generator as a whole: that a seed reproduces a whole run rather
 * than a single value, that a derived generator holds still, and that the
 * dataset and reference instant a caller supplies reach every module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Dataset } from "./dataset";

import { en } from "./data/en";
import { createRandom } from "./random";
import { createSample } from "./sample";

const REFERENCE = new Date("2026-06-15T12:00:00.000Z");

function run(seed: string) {
	let sample = createSample({ seed, now: REFERENCE });
	return {
		people: sample.helpers.multiple(() => sample.person.record(), { count: 5 }),
		city: sample.location.city(),
		company: sample.company.name(),
		blurb: sample.lorem.paragraph(),
		id: sample.string.uuid(),
		amount: sample.number.float(),
		when: sample.date.past().toISOString(),
	};
}

describe("determinism", () => {
	test("reproduces a whole run from the same seed", () => {
		expect(run("release")).toEqual(run("release"));
	});

	test("gives different seeds different data", () => {
		expect(run("release")).not.toEqual(run("staging"));
	});

	test("reports the seed it replays from", () => {
		expect(createSample({ seed: 99 }).seed).toBe(99);
		expect(createSample({ seed: "signup" }).seed).toBe("signup");
	});

	test("draws from a stream that is already open", () => {
		let random = createRandom("shared");
		let sample = createSample({ seed: random });

		expect(sample.seed).toBe("shared");
		expect(sample.person.firstName()).toBe(createSample({ seed: "shared" }).person.firstName());
	});
});

describe("derive", () => {
	test("holds a label's values still as the parent draws more", () => {
		let untouched = createSample({ seed: "fixture" });
		let exhausted = createSample({ seed: "fixture" });
		exhausted.helpers.multiple(() => exhausted.person.record(), { count: 20 });

		expect(untouched.derive("orders").string.uuid()).toBe(exhausted.derive("orders").string.uuid());
	});

	test("gives different labels different data", () => {
		let sample = createSample({ seed: "fixture" });

		expect(sample.derive("orders").string.uuid()).not.toBe(sample.derive("invoices").string.uuid());
	});

	test("carries the dataset and reference instant with it", () => {
		let data: Dataset = {
			...en,
			firstNames: { female: ["Ada"], male: ["Ada"] },
			lastNames: ["Lovelace"],
			countries: [{ name: "Nowhere", code: "NW", cities: ["Somewhere"] }],
			companyWords: ["Analytical"],
			companySuffixes: ["Engine"],
			lorem: ["note"],
		};
		let orders = createSample({ seed: "fixture", data, now: REFERENCE }).derive("orders");

		expect(orders.person.fullName()).toBe("Ada Lovelace");
		expect(orders.date.past({ days: 0 })).toEqual(REFERENCE);
	});
});

describe("options", () => {
	test("hands a caller's dataset to every module that reads one", () => {
		let data: Dataset = {
			...en,
			firstNames: { female: ["Ada"], male: ["Ada"] },
			lastNames: ["Lovelace"],
			countries: [{ name: "Nowhere", code: "NW", cities: ["Somewhere"] }],
			companyWords: ["Analytical"],
			companySuffixes: ["Engine"],
			lorem: ["note"],
		};
		let sample = createSample({ seed: "custom", data });

		expect(sample.person.fullName()).toBe("Ada Lovelace");
		expect(sample.internet.username()).toBe("ada.lovelace");
		expect(sample.location.city()).toBe("Somewhere");
		expect(sample.company.name()).toBe("Analytical Engine");
		expect(sample.lorem.words(2)).toBe("note note");
	});

	test("measures dates from the reference instant it is given", () => {
		let sample = createSample({ seed: "clock", now: REFERENCE });

		expect(sample.date.past({ days: 0 })).toEqual(REFERENCE);
		expect(sample.date.future({ days: 0 })).toEqual(REFERENCE);
	});

	test("falls back to the current time when no reference is given", () => {
		let before = Date.now();
		let sample = createSample({ seed: "clock" });
		let value = sample.date.past({ days: 0 }).getTime();

		expect(value).toBeGreaterThanOrEqual(before);
		expect(value).toBeLessThanOrEqual(Date.now());
	});
});
