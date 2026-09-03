/**
 * Tests for people: that a record's fields describe one person rather than
 * several, and that a phone number stays in the range reserved for fiction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Dataset } from "../dataset.js";

import { en } from "../data/en.js";
import { createRandom } from "../random.js";

import { createInternetModule } from "./internet.js";
import { createPersonModule } from "./person.js";
import { createPhoneModule } from "./phone.js";

function module(seed: string, data: Dataset = en) {
	let random = createRandom(seed);
	return createPersonModule(
		random,
		data,
		createInternetModule(random, data),
		createPhoneModule(random),
	);
}

describe("names", () => {
	test("draws from the dataset", () => {
		let person = module("names");

		expect([...en.firstNames.female, ...en.firstNames.male]).toContain(person.firstName());
		expect(en.lastNames).toContain(person.lastName());
	});

	test("joins a full name from both halves", () => {
		let person = module("full", {
			...en,
			firstNames: { female: ["Ada"], male: ["Ada"] },
			lastNames: ["Lovelace"],
		});

		expect(person.fullName()).toBe("Ada Lovelace");
	});
});

describe("phone", () => {
	test("delegates to the phone module, in its national format", () => {
		let person = module("phones");

		for (let count = 0; count < 300; count++) {
			expect(person.phone()).toMatch(/^\(555\) 555-01\d{2}$/);
		}
	});

	test("pads the line number to two digits", () => {
		let person = module("padding");
		let numbers = Array.from({ length: 300 }, () => person.phone());

		for (let number of numbers) expect(number).toHaveLength(14);
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
		let person = module("handles", {
			...en,
			firstNames: { female: ["Lucía"], male: ["Lucía"] },
			lastNames: ["Ibáñez"],
		});
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

describe("titles and identity", () => {
	test("draws a prefix and suffix from the dataset", () => {
		let person = module("titles");

		expect(en.namePrefixes).toContain(person.prefix());
		expect(en.nameSuffixes).toContain(person.suffix());
	});

	test("wraps a full name in titles on request", () => {
		let person = module("titles");
		let full = person.fullName({ withPrefix: true, withSuffix: true });

		expect(full.split(" ").length).toBeGreaterThanOrEqual(4);
	});

	test("uses the parts it is given", () => {
		expect(module("given").fullName({ firstName: "Ada", lastName: "Lovelace" })).toBe(
			"Ada Lovelace",
		);
	});

	test("draws a given name from the sex it is asked for", () => {
		let person = module("sexes");

		for (let count = 0; count < 50; count++) {
			expect(en.firstNames.female).toContain(person.firstName({ sex: "female" }));
			expect(en.firstNames.male).toContain(person.firstName({ sex: "male" }));
		}
	});

	test("reports a sex, a sex type, a gender and a sign", () => {
		let person = module("identity");

		expect(en.sexes).toContain(person.sex());
		expect(["female", "male"]).toContain(person.sexType());
		expect(en.genders).toContain(person.gender());
		expect(en.zodiacSigns).toContain(person.zodiacSign());
	});
});

describe("work", () => {
	test("draws each part of a job title from its own list", () => {
		let person = module("jobs");

		expect(en.jobAreas).toContain(person.jobArea());
		expect(en.jobDescriptors).toContain(person.jobDescriptor());
		expect(en.jobTypes).toContain(person.jobType());
	});

	test("joins a whole title from the three", () => {
		let person = module("jobs");
		let [descriptor, area, ...type] = person.jobTitle().split(" ");

		expect(en.jobDescriptors).toContain(descriptor);
		expect(en.jobAreas).toContain(area);
		expect(en.jobTypes).toContain(type.join(" "));
	});

	test("writes a bio", () => {
		expect(module("bios").bio().length).toBeGreaterThan(5);
	});

	test("puts a job title and a number on a record", () => {
		let record = module("records").record();

		expect(record.jobTitle.split(" ").length).toBeGreaterThanOrEqual(3);
		expect(record.phone).toMatch(/^\(555\) 555-01\d{2}$/);
		expect(["female", "male"]).toContain(record.sex);
	});
});
