/**
 * Tests for places: that a city asked for by country comes from that country,
 * and that a country the dataset does not carry is refused rather than quietly
 * answered with a city from somewhere else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Dataset } from "../dataset";

import { en } from "../data/en";
import { createRandom } from "../random";

import { createLocationModule } from "./location";

function module(seed: string, data: Dataset = en) {
	return createLocationModule(createRandom(seed), data);
}

describe("city", () => {
	test("returns a city of the country it is given", () => {
		let location = module("countries");

		for (let country of en.countries) {
			for (let count = 0; count < 20; count++) {
				expect(country.cities).toContain(location.city({ country: country.name }));
			}
		}
	});

	test("reaches every city a country holds", () => {
		let location = module("coverage");
		let seen = new Set(Array.from({ length: 200 }, () => location.city({ country: "Japan" })));

		expect([...seen].sort()).toEqual(["Kyoto", "Osaka", "Sapporo", "Tokyo", "Yokohama"].sort());
	});

	test("spans countries when none is named", () => {
		let location = module("anywhere");
		let seen = new Set(Array.from({ length: 400 }, () => location.city()));

		expect(seen.size).toBeGreaterThan(50);
	});

	test("names the country it could not find", () => {
		expect(() => module("missing").city({ country: "Atlantis" })).toThrow(
			/no country named "Atlantis" in the dataset/,
		);
	});

	test("matches a country by its exact name", () => {
		expect(() => module("case").city({ country: "japan" })).toThrow(RangeError);
	});
});

describe("country", () => {
	test("draws from the dataset", () => {
		let location = module("names");
		let names = en.countries.map((country) => country.name);

		for (let count = 0; count < 100; count++) {
			expect(names).toContain(location.country());
		}
	});
});

describe("a caller's own places", () => {
	test("draws from the countries it was handed", () => {
		let data: Dataset = { ...en, countries: [{ name: "Nowhere", cities: ["Somewhere"] }] };
		let location = module("custom", data);

		expect(location.country()).toBe("Nowhere");
		expect(location.city()).toBe("Somewhere");
		expect(location.city({ country: "Nowhere" })).toBe("Somewhere");
	});
});
