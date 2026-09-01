/**
 * Tests for people: that a record's fields describe one person rather than
 * several, and that a phone number stays in the range reserved for fiction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Dataset } from "../dataset";

import { en } from "../data/en";
import { createRandom } from "../random";

import { createInternetModule } from "./internet";
import { createPersonModule } from "./person";

function module(seed: string, data: Dataset = en) {
	let random = createRandom(seed);
	return createPersonModule(random, data, createInternetModule(random, data));
}

describe("names", () => {
	test("draws from the dataset", () => {
		let person = module("names");

		expect(en.firstNames).toContain(person.firstName());
		expect(en.lastNames).toContain(person.lastName());
	});

	test("joins a full name from both halves", () => {
		let person = module("full", { ...en, firstNames: ["Ada"], lastNames: ["Lovelace"] });

		expect(person.fullName()).toBe("Ada Lovelace");
	});
});

describe("phone", () => {
	test("stays in the range reserved for fiction", () => {
		let person = module("phones");

		for (let count = 0; count < 300; count++) {
			expect(person.phone()).toMatch(/^\+1 555-01\d{2}$/);
		}
	});

	test("pads the line number to two digits", () => {
		let person = module("padding");
		let numbers = Array.from({ length: 300 }, () => person.phone());

		for (let number of numbers) expect(number).toHaveLength(11);
		expect(numbers.some((number) => number.endsWith("00"))).toBe(true);
	});
});

describe("record", () => {
	test("describes one person across every field", () => {
		let person = module("records");

		for (let count = 0; count < 100; count++) {
			let record = person.record();
			expect(record.fullName).toBe(`${record.firstName} ${record.lastName}`);
			expect(record.email.startsWith(`${record.username}`)).toBe(true);
			expect(record.email).toMatch(/@example\.(com|org|net)$/);
		}
	});

	test("builds the handle from the record's own name", () => {
		let person = module("handles", { ...en, firstNames: ["Lucía"], lastNames: ["Ibáñez"] });
		let record = person.record();

		expect(record.username).toBe("lucia.ibanez");
		expect(record.email).toMatch(/^lucia\.ibanez\d{1,2}@example\.(com|org|net)$/);
	});

	test("returns a different person on each call", () => {
		let person = module("varies");
		let seen = new Set(Array.from({ length: 100 }, () => person.record().email));

		expect(seen.size).toBeGreaterThan(90);
	});
});
