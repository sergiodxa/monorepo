/**
 * Tests for company names: that both halves come from the dataset, and that the
 * generated name varies rather than settling on one word.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Dataset } from "../dataset";

import { en } from "../data/en";
import { createRandom } from "../random";

import { createCompanyModule } from "./company";

function module(seed: string, data: Dataset = en) {
	return createCompanyModule(createRandom(seed), data);
}

describe("name", () => {
	test("joins a word from the dataset to a closing word", () => {
		let company = module("names");

		for (let count = 0; count < 200; count++) {
			let [word, suffix] = company.name().split(" ");
			expect(en.companyWords).toContain(word);
			expect(en.companySuffixes).toContain(suffix);
		}
	});

	test("varies across calls", () => {
		let company = module("varies");
		let seen = new Set(Array.from({ length: 200 }, () => company.name()));

		expect(seen.size).toBeGreaterThan(100);
	});

	test("draws from the lists it was handed", () => {
		let data: Dataset = { ...en, companyWords: ["Analytical"], companySuffixes: ["Engine"] };

		expect(module("custom", data).name()).toBe("Analytical Engine");
	});
});

describe("phrases", () => {
	test("draws each catch phrase part from its own list", () => {
		let company = module("catch");

		expect(en.catchPhraseAdjectives).toContain(company.catchPhraseAdjective());
		expect(en.catchPhraseDescriptors).toContain(company.catchPhraseDescriptor());
		expect(en.catchPhraseNouns).toContain(company.catchPhraseNoun());
	});

	test("draws each buzz part from its own list", () => {
		let company = module("buzz");

		expect(en.buzzAdjectives).toContain(company.buzzAdjective());
		expect(en.buzzNouns).toContain(company.buzzNoun());
		expect(en.buzzVerbs).toContain(company.buzzVerb());
	});

	test("joins whole phrases from three parts each", () => {
		let company = module("phrases");

		expect(company.catchPhrase().length).toBeGreaterThan(10);
		expect(company.buzzPhrase().length).toBeGreaterThan(10);
	});

	test("varies across calls", () => {
		let company = module("varies");
		let seen = new Set(Array.from({ length: 100 }, () => company.catchPhrase()));

		expect(seen.size).toBeGreaterThan(90);
	});
});
