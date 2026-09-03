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
		let data: Dataset = {
			...en,
			countries: [{ name: "Nowhere", code: "NW", cities: ["Somewhere"] }],
		};
		let location = module("custom", data);

		expect(location.country()).toBe("Nowhere");
		expect(location.city()).toBe("Somewhere");
		expect(location.city({ country: "Nowhere" })).toBe("Somewhere");
	});
});

describe("addresses", () => {
	test("writes a street, a number, and the two joined", () => {
		let location = module("streets");

		expect(location.street()).toMatch(/^[A-Za-z]+ [A-Za-z]+$/);
		expect(location.buildingNumber()).toMatch(/^\d{1,4}$/);
		expect(location.streetAddress()).toMatch(/^\d{1,4} [A-Za-z]+ [A-Za-z]+$/);
	});

	test("adds a unit on request", () => {
		expect(
			module("units").streetAddress({ useFullAddress: true }).split(" ").length,
		).toBeGreaterThan(3);
	});

	test("writes a secondary address and a postal code", () => {
		let location = module("units");

		expect(location.secondaryAddress()).toMatch(/^[A-Za-z.]+ \d{1,3}$/);
		expect(location.zipCode()).toMatch(/^\d{5}$/);
	});

	test("writes a whole address on one line", () => {
		let address = module("postal").postalAddress();

		expect(address.split(", ")).toHaveLength(3);
		expect(address).toMatch(/\d{5}/);
	});
});

describe("regions", () => {
	test("draws a country code, a continent, a county and a language", () => {
		let location = module("regions");

		expect(en.countries.map((country) => country.code)).toContain(location.countryCode());
		expect(en.continents).toContain(location.continent());
		expect(en.counties).toContain(location.county());
		expect(en.languages).toContain(location.language());
	});

	test("returns a state by name or abbreviation", () => {
		let location = module("states");

		expect(en.states.map((state) => state.name)).toContain(location.state());
		expect(en.states.map((state) => state.abbreviation)).toContain(
			location.state({ abbreviated: true }),
		);
	});

	test("draws a time zone from the dataset", () => {
		expect(en.timeZones).toContain(module("zones").timeZone());
	});
});

describe("directions and coordinates", () => {
	test("splits the compass into cardinal and ordinal", () => {
		let location = module("compass");

		for (let count = 0; count < 50; count++) {
			expect(["North", "East", "South", "West"]).toContain(location.cardinalDirection());
			expect(["Northeast", "Northwest", "Southeast", "Southwest"]).toContain(
				location.ordinalDirection(),
			);
			expect(en.directions).toContain(location.direction());
		}
	});

	test("keeps coordinates inside their range", () => {
		let location = module("coordinates");

		for (let count = 0; count < 100; count++) {
			expect(Math.abs(location.latitude())).toBeLessThanOrEqual(90);
			expect(Math.abs(location.longitude())).toBeLessThanOrEqual(180);
		}
	});

	test("honors the bounds it is given", () => {
		let location = module("bounded");
		let value = location.latitude({ min: 10, max: 20 });

		expect(value).toBeGreaterThanOrEqual(10);
		expect(value).toBeLessThanOrEqual(20);
	});

	test("stays near the point it was given", () => {
		let location = module("nearby");
		let origin: [number, number] = [40.4168, -3.7038];

		for (let count = 0; count < 50; count++) {
			let [latitude, longitude] = location.nearbyGPSCoordinate({ origin, radius: 5 });
			expect(Math.abs(latitude - origin[0])).toBeLessThan(0.1);
			expect(Math.abs(longitude - origin[1])).toBeLessThan(0.2);
		}
	});
});
