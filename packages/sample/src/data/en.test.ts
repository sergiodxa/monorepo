/**
 * Tests for the English dataset's invariants: no repeated entry, since a repeat
 * quietly weights one value over the rest, and no country without cities, since
 * a city can be asked for by country.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { en } from "./en";

function duplicates(values: readonly string[]): string[] {
	let seen = new Set<string>();
	return values.filter((value) => {
		if (seen.has(value)) return true;
		seen.add(value);
		return false;
	});
}

describe("the English dataset", () => {
	test("holds each entry once", () => {
		expect(duplicates(en.firstNames.female)).toEqual([]);
		expect(duplicates(en.firstNames.male)).toEqual([]);
		expect(duplicates(en.lastNames)).toEqual([]);
		expect(duplicates(en.companyWords)).toEqual([]);
		expect(duplicates(en.companySuffixes)).toEqual([]);
		expect(duplicates(en.lorem)).toEqual([]);
		expect(duplicates(en.countries.map((country) => country.name))).toEqual([]);
	});

	test("gives every country cities of its own", () => {
		for (let country of en.countries) {
			expect(country.cities.length).toBeGreaterThan(0);
			expect(duplicates(country.cities)).toEqual([]);
		}
	});

	test("carries enough of each list to keep values varied", () => {
		expect(en.firstNames.female.length + en.firstNames.male.length).toBeGreaterThanOrEqual(100);
		expect(en.lastNames.length).toBeGreaterThanOrEqual(100);
		expect(en.countries.length).toBeGreaterThanOrEqual(40);
		expect(en.companyWords.length).toBeGreaterThanOrEqual(60);
		expect(en.lorem.length).toBeGreaterThanOrEqual(200);
	});
});
