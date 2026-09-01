/**
 * Tests for the generator's public contract: that a seed reproduces a whole
 * run, that a person's fields agree with each other, that generated contact
 * details are unroutable, and that each module honors its options.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Dataset } from "./dataset";

import { createSample } from "./sample";

const RESERVED = /@example\.(com|org|net)$/;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const REFERENCE = new Date("2026-06-15T12:00:00.000Z");

describe("determinism", () => {
	test("reproduces a whole run from the same seed", () => {
		let build = () => {
			let sample = createSample({ seed: "run", now: REFERENCE });
			return {
				people: sample.helpers.multiple(() => sample.person.record(), { count: 5 }),
				city: sample.location.city(),
				id: sample.string.uuid(),
				when: sample.date.past().toISOString(),
			};
		};

		expect(build()).toEqual(build());
	});

	test("gives different seeds different data", () => {
		let first = createSample({ seed: "one" }).person.record();
		let second = createSample({ seed: "two" }).person.record();

		expect(first).not.toEqual(second);
	});

	test("reports the seed it replays from", () => {
		expect(createSample({ seed: 99 }).seed).toBe(99);
	});

	test("accepts an already open stream", () => {
		let sample = createSample({ seed: "shared" });
		let derived = createSample({ seed: sample.derive("orders").seed });

		expect(derived.seed).toBe("shared orders");
	});
});

describe("derive", () => {
	test("holds a label's values still as the parent draws more", () => {
		let untouched = createSample({ seed: "fixture" });
		let exhausted = createSample({ seed: "fixture" });
		exhausted.helpers.multiple(() => exhausted.person.record(), { count: 20 });

		expect(untouched.derive("orders").string.uuid()).toBe(exhausted.derive("orders").string.uuid());
	});
});

describe("person", () => {
	test("builds a record whose fields agree with each other", () => {
		let sample = createSample({ seed: "person" });
		let person = sample.person.record();

		expect(person.fullName).toBe(`${person.firstName} ${person.lastName}`);
		expect(person.email.startsWith(person.username)).toBe(true);
		expect(person.email).toMatch(RESERVED);
	});

	test("folds an accented name into an ASCII handle", () => {
		let sample = createSample({ seed: "handle" });

		expect(sample.internet.username({ firstName: "Lucía", lastName: "Ibáñez" })).toBe(
			"lucia.ibanez",
		);
	});

	test("draws phone numbers from the range reserved for fiction", () => {
		let sample = createSample({ seed: "phones" });

		for (let count = 0; count < 100; count++) {
			expect(sample.person.phone()).toMatch(/^\+1 555-01\d{2}$/);
		}
	});
});

describe("internet", () => {
	test("keeps every generated address on a reserved domain", () => {
		let sample = createSample({ seed: "addresses" });

		for (let count = 0; count < 200; count++) {
			expect(sample.internet.email()).toMatch(RESERVED);
		}
	});

	test("keeps every generated link on a reserved domain", () => {
		let sample = createSample({ seed: "links" });

		for (let count = 0; count < 100; count++) {
			expect(sample.internet.url()).toMatch(/^https:\/\/[a-z0-9]+\.example\.(com|org|net)$/);
		}
	});

	test("builds a password of the requested length", () => {
		let sample = createSample({ seed: "passwords" });

		expect(sample.internet.password()).toHaveLength(16);
		expect(sample.internet.password({ length: 32 })).toHaveLength(32);
	});
});

describe("location", () => {
	test("returns a city that belongs to the country asked for", () => {
		let sample = createSample({ seed: "cities" });
		let japanese = ["Tokyo", "Osaka", "Kyoto", "Yokohama", "Sapporo"];

		for (let count = 0; count < 50; count++) {
			expect(japanese).toContain(sample.location.city({ country: "Japan" }));
		}
	});

	test("refuses a country the dataset does not carry", () => {
		let sample = createSample({ seed: "cities" });

		expect(() => sample.location.city({ country: "Atlantis" })).toThrow(
			/no country named "Atlantis"/,
		);
	});

	test("returns a city from anywhere when no country is named", () => {
		let sample = createSample({ seed: "anywhere" });
		let cities = new Set(sample.helpers.multiple(() => sample.location.city(), { count: 100 }));

		expect(cities.size).toBeGreaterThan(10);
	});
});

describe("lorem", () => {
	test("returns exactly the words asked for", () => {
		let sample = createSample({ seed: "words" });

		expect(sample.lorem.words(5).split(" ")).toHaveLength(5);
		expect(sample.lorem.words(0)).toBe("");
	});

	test("capitalizes a sentence and closes it", () => {
		let sample = createSample({ seed: "sentences" });
		let sentence = sample.lorem.sentence();

		expect(sentence.charAt(0)).toBe(sentence.charAt(0).toUpperCase());
		expect(sentence.endsWith(".")).toBe(true);
	});

	test("runs a paragraph to the requested number of sentences", () => {
		let sample = createSample({ seed: "paragraphs" });

		expect(sample.lorem.paragraph({ sentences: 3 }).match(/\./g)).toHaveLength(3);
	});
});

describe("number and string", () => {
	test("keeps an integer inside its bounds", () => {
		let sample = createSample({ seed: "numbers" });

		for (let count = 0; count < 200; count++) {
			let value = sample.number.int({ min: 10, max: 20 });
			expect(value).toBeGreaterThanOrEqual(10);
			expect(value).toBeLessThanOrEqual(20);
		}
	});

	test("rounds a float to the digits asked for", () => {
		let sample = createSample({ seed: "floats" });
		let value = sample.number.float({ min: 0, max: 100, fractionDigits: 3 });

		expect(value).toBe(Number(value.toFixed(3)));
	});

	test("shapes a uuid as version 4", () => {
		let sample = createSample({ seed: "ids" });

		for (let count = 0; count < 100; count++) {
			expect(sample.string.uuid()).toMatch(UUID_V4);
		}
	});

	test("builds character runs of the requested length", () => {
		let sample = createSample({ seed: "runs" });

		expect(sample.string.alphanumeric(12)).toMatch(/^[a-z0-9]{12}$/);
		expect(sample.string.hex(32)).toMatch(/^[0-9a-f]{32}$/);
	});
});

describe("date", () => {
	test("measures from the reference instant rather than the clock", () => {
		let sample = createSample({ seed: "dates", now: REFERENCE });
		let past = sample.date.past({ days: 30 });

		expect(past.getTime()).toBeLessThanOrEqual(REFERENCE.getTime());
		expect(past.getTime()).toBeGreaterThanOrEqual(REFERENCE.getTime() - 30 * 86_400_000);
	});

	test("places a future instant after the reference", () => {
		let sample = createSample({ seed: "dates", now: REFERENCE });
		let future = sample.date.future({ days: 7 });

		expect(future.getTime()).toBeGreaterThanOrEqual(REFERENCE.getTime());
		expect(future.getTime()).toBeLessThanOrEqual(REFERENCE.getTime() + 7 * 86_400_000);
	});

	test("stays inside an explicit range", () => {
		let sample = createSample({ seed: "between" });
		let from = new Date("2026-01-01T00:00:00.000Z");
		let to = new Date("2026-02-01T00:00:00.000Z");

		for (let count = 0; count < 50; count++) {
			let value = sample.date.between({ from, to });
			expect(value.getTime()).toBeGreaterThanOrEqual(from.getTime());
			expect(value.getTime()).toBeLessThanOrEqual(to.getTime());
		}
	});

	test("refuses a range that ends before it starts", () => {
		let sample = createSample({ seed: "between" });

		expect(() =>
			sample.date.between({
				from: new Date("2026-02-01T00:00:00.000Z"),
				to: new Date("2026-01-01T00:00:00.000Z"),
			}),
		).toThrow(RangeError);
	});
});

describe("helpers", () => {
	test("picks distinct elements", () => {
		let sample = createSample({ seed: "helpers" });
		let picked = sample.helpers.pickMany([1, 2, 3, 4, 5], { count: 3 });

		expect(picked).toHaveLength(3);
		expect(new Set(picked).size).toBe(3);
	});

	test("refuses to pick more elements than the list holds", () => {
		let sample = createSample({ seed: "helpers" });

		expect(() => sample.helpers.pickMany([1, 2], { count: 3 })).toThrow(RangeError);
	});

	test("repeats a generator with its index", () => {
		let sample = createSample({ seed: "helpers" });

		expect(sample.helpers.multiple((index) => index, { count: 4 })).toEqual([0, 1, 2, 3]);
	});

	test("treats a chance of zero and one as never and always", () => {
		let sample = createSample({ seed: "helpers" });

		expect(sample.helpers.maybe(() => "value", { chance: 0 })).toBeNull();
		expect(sample.helpers.maybe(() => "value", { chance: 1 })).toBe("value");
	});
});

describe("a caller's own dataset", () => {
	test("draws from the lists it was handed", () => {
		let data: Dataset = {
			firstNames: ["Alfa"],
			lastNames: ["Bravo"],
			countries: [{ name: "Nowhere", cities: ["Charlie"] }],
			companyWords: ["Delta"],
			companySuffixes: ["Works"],
			lorem: ["echo"],
		};
		let sample = createSample({ seed: "custom", data });

		expect(sample.person.fullName()).toBe("Alfa Bravo");
		expect(sample.location.city({ country: "Nowhere" })).toBe("Charlie");
		expect(sample.company.name()).toBe("Delta Works");
		expect(sample.lorem.words(2)).toBe("echo echo");
	});
});
